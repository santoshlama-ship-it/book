/**
 * Coverdesk <-> Google Sheets bridge.
 * Bind this script to the Coverdesk_Data spreadsheet and deploy it as a Web app.
 * Store the same secret used by GOOGLE_SHEETS_SYNC_SECRET in Script Properties as SYNC_SECRET.
 */

const ALL_COVERS = 'All Covers';
const COMMENTS = 'Comments';
const COVER_HEADERS = [
  'Grade', 'Subject', 'Version', 'Google Drive Link', 'Main Concept',
  'Series Consistency', 'Status', 'Notes', 'Approved By ', 'Approval Date',
  'Cover ID', 'Theme & Inspiration', 'Fonts & Typography',
  'Illustration & Character Style', 'Cover Specifications', 'Files Delivered',
  'Usage Guidelines'
];
const COMMENT_HEADERS = ['Grade', 'Subject', 'Commenter', 'Comment', 'Displayed Time', 'Done', 'Cover ID', 'Comment ID', 'Pin X', 'Pin Y'];

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function secretIsValid_(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty('SYNC_SECRET');
  return Boolean(expected && secret && expected === secret);
}

function normaliseStatus_(value) {
  const key = String(value || '').trim().toLowerCase();
  const statuses = {
    'brief ready': 'Not Started', 'not started': 'Not Started',
    'client review': 'Ready for Review', 'ready for review': 'Ready for Review',
    'in design': 'Working On', 'working on': 'Working On',
    'approved': 'Approved',
    'needs changes': 'Changes Needed', 'changes needed': 'Changes Needed',
    'redo': 'Redo', 'on hold': 'On Hold'
  };
  return statuses[key] || 'Not Started';
}

function asDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}

function matchKey_(grade, subject, version) {
  return [grade, subject, version || 'V1'].map(value => String(value || '').trim().toLowerCase()).join('|');
}

function noteLines_(value) {
  return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function noteCommentId_(key, text) {
  const value = `${key}|${text}`;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash) || 1;
}

function sheet_(name) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function rowsByHeader_(sheet, headerRow, headers) {
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  if (lastRow < headerRow) return [];
  const values = sheet.getRange(headerRow, 1, lastRow - headerRow + 1, lastColumn).getDisplayValues();
  const actualHeaders = values.shift() || [];
  const positions = headers.reduce((map, header) => {
    map[header] = actualHeaders.indexOf(header);
    return map;
  }, {});
  return values.filter(row => row.some(Boolean)).map(row => headers.reduce((item, header) => {
    item[header] = positions[header] >= 0 ? row[positions[header]] : '';
    return item;
  }, {}));
}

function readState_() {
  const covers = rowsByHeader_(sheet_(ALL_COVERS), 2, COVER_HEADERS);
  const designs = covers.map((row, index) => ({
    id: row['Cover ID'] || `sheet-${index}-${row.Grade}-${row.Subject}`,
    grade: row.Grade,
    subject: row.Subject,
    version: row.Version || 'V1',
    image: row['Google Drive Link'],
    concept: row['Main Concept'],
    inspiration: row['Theme & Inspiration'],
    palette: [],
    status: normaliseStatus_(row.Status),
    details: {
      typography: row['Fonts & Typography'],
      illustration: row['Illustration & Character Style'],
      consistency: row['Series Consistency'],
      specifications: row['Cover Specifications'],
      delivered: row['Files Delivered'],
      usage: row['Usage Guidelines'],
      approval: row.Notes
    },
    ...(row['Approved By '] ? { approval: { designer: '', client: row['Approved By '], date: asDate_(row['Approval Date']) } } : {})
  })).filter(cover => cover.grade || cover.subject);

  const positionById = designs.reduce((map, cover, index) => { map[cover.id] = index; return map; }, {});
  const comments = rowsByHeader_(sheet_(COMMENTS), 4, COMMENT_HEADERS).reduce((result, row) => {
    const coverPosition = positionById[row['Cover ID']];
    if (coverPosition === undefined) return result;
    (result[coverPosition] ||= []).push({
      id: Number(row['Comment ID']) || Date.now(),
      name: row.Commenter,
      text: row.Comment,
      time: row['Displayed Time'] || 'From Google Sheets',
      done: String(row.Done).toLowerCase() === 'true',
      ...(row['Pin X'] !== '' && row['Pin Y'] !== '' ? { pin: { x: Number(row['Pin X']), y: Number(row['Pin Y']) } } : {})
    });
    return result;
  }, {});

  const positionByMatch = designs.reduce((map, cover, index) => {
    map[matchKey_(cover.grade, cover.subject, cover.version)] = index;
    return map;
  }, {});
  const addSheetNote = (coverPosition, note) => {
    if (coverPosition === undefined || !note) return;
    const items = comments[coverPosition] ||= [];
    if (items.some(comment => String(comment.text || '').trim().toLowerCase() === note.toLowerCase())) return;
    const cover = designs[coverPosition];
    items.push({
      id: noteCommentId_(matchKey_(cover.grade, cover.subject, cover.version), note),
      name: 'Sheet note', text: note, time: 'From Google Sheets', done: false
    });
  };

  covers.forEach((row, index) => noteLines_(row.Notes).forEach(note => addSheetNote(index, note)));
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  [...new Set(designs.map(cover => cover.subject).filter(Boolean))].forEach(subject => {
    const subjectSheet = spreadsheet.getSheetByName(String(subject).slice(0, 100).replace(/[\\/?*\[\]:]/g, '-'));
    if (!subjectSheet) return;
    rowsByHeader_(subjectSheet, 1, COVER_HEADERS).forEach(row => {
      const position = positionByMatch[matchKey_(row.Grade, row.Subject || subject, row.Version)];
      noteLines_(row.Notes).forEach(note => addSheetNote(position, note));
    });
  });
  designs.forEach((cover, index) => {
    if ((comments[index] || []).length) cover.status = 'Changes Needed';
  });
  return { designs, comments };
}

function writeTable_(sheet, headerRow, headers, rows) {
  const requiredRows = headerRow + Math.max(rows.length, 1);
  if (sheet.getMaxRows() < requiredRows) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  sheet.getRange(headerRow, 1, Math.max(sheet.getLastRow() - headerRow + 1, 1), headers.length).clearContent();
  sheet.getRange(headerRow, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(headerRow + 1, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(headerRow, 1, Math.max(rows.length + 1, 1), headers.length).setWrap(true).setVerticalAlignment('top');
}

function coverRows_(designs, comments) {
  return designs.map((cover, position) => [
    cover.grade || '', cover.subject || '', cover.version || 'V1', cover.image || '',
    cover.concept || '', cover.details?.consistency || '', normaliseStatus_(cover.status),
    comments && comments[position] ? comments[position].map(comment => comment.text).filter(Boolean).join('\n') : cover.details?.approval || '', cover.approval?.client || '', cover.approval?.date || '',
    cover.id || Utilities.getUuid(), cover.inspiration || '', cover.details?.typography || '',
    cover.details?.illustration || '', cover.details?.specifications || '',
    cover.details?.delivered || '', cover.details?.usage || ''
  ]);
}

function refreshStatusTabs_(designs) {
  const groups = {
    'Brief Ready': 'Not Started', 'Client Review': 'Ready for Review', 'In Design': 'Working On',
    'Approved': 'Approved', 'Needs Changes': 'Changes Needed'
  };
  Object.keys(groups).forEach(name => {
    const target = sheet_(name);
    const rows = coverRows_(designs.filter(cover => normaliseStatus_(cover.status) === groups[name]));
    writeTable_(target, 4, COVER_HEADERS, rows);
    target.getRange('A1').setValue(name);
    target.getRange('A2').setValue('Automatic view — edit records in the All Covers tab.');
  });
}

function refreshSubjectTabs_(designs) {
  const subjects = [...new Set(designs.map(cover => String(cover.subject || '').trim()).filter(Boolean))];
  subjects.forEach(subject => {
    const safeTitle = subject.slice(0, 100).replace(/[\\/?*\[\]:]/g, '-');
    const safeQuery = subject.replace(/'/g, "''");
    const target = sheet_(safeTitle);
    target.clearContents();
    target.getRange('A1').setFormula(`=QUERY('${ALL_COVERS}'!A2:J,"select * where B = '${safeQuery}'",1)`);
    target.setFrozenRows(1);
    target.getRange(1, 1, target.getMaxRows(), 10).setWrap(true).setVerticalAlignment('top');
  });
}

function writeState_(state) {
  const designs = Array.isArray(state.designs) ? state.designs : [];
  const comments = state.comments && typeof state.comments === 'object' ? state.comments : {};
  designs.forEach((cover, position) => {
    if ((comments[position] || []).length) cover.status = 'Changes Needed';
  });
  const allRows = coverRows_(designs, comments);
  writeTable_(sheet_(ALL_COVERS), 2, COVER_HEADERS, allRows);

  const commentRows = [];
  designs.forEach((cover, position) => (comments[position] || []).forEach(comment => commentRows.push([
    cover.grade || '', cover.subject || '', comment.name || '', comment.text || '', comment.time || '',
    Boolean(comment.done), cover.id || '', Number(comment.id) || Date.now(),
    comment.pin?.x ?? '', comment.pin?.y ?? ''
  ])));
  const commentSheet = sheet_(COMMENTS);
  writeTable_(commentSheet, 4, COMMENT_HEADERS, commentRows);
  commentSheet.getRange('A1').setValue('Comments');
  commentSheet.getRange('A2').setValue('All client feedback and completion states.');
  refreshStatusTabs_(designs);
  refreshSubjectTabs_(designs);
}

function doGet(event) {
  try {
    if (!secretIsValid_(event.parameter.secret)) return json_({ ok: false, error: 'Unauthorised' });
    return json_(Object.assign({ ok: true }, readState_()));
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message || error) });
  }
}

function doPost(event) {
  try {
    const body = JSON.parse(event.postData.contents || '{}');
    if (!secretIsValid_(body.secret)) return json_({ ok: false, error: 'Unauthorised' });
    writeState_(body);
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message || error) });
  }
}
