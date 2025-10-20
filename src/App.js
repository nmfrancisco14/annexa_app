import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, User, Upload } from 'lucide-react';
// import { Modal, Button } from "react-bootstrap";
// import "bootstrap/dist/css/bootstrap.min.css";
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

const StaffReportApp = () => {
  const [staffData, setStaffData] = useState({});
  const [selectedStaff, setSelectedStaff] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileName, setFileName] = useState('');
  const [avatars, setAvatars] = useState({});
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  // Theme: 'light' | 'dark' persisted in localStorage and applied to <html> via `dark` class
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch (e) {}
    return 'light';
  });
  // pagination removed — table now scrolls vertically inside its container


  useEffect(() => {
    const savedData = window.staffReportData;
    if (savedData) {
      setStaffData(savedData.data);
      setFileName(savedData.fileName);
      if (Object.keys(savedData.data).length > 0) {
        setSelectedStaff(Object.keys(savedData.data)[0]);
      }
    }
    
  }, []);

  // ✅ Show the modal once when app loads
 // useEffect(() => {
  //   const modal = new window.bootstrap.Modal(
  //     document.getElementById("infoModal")
  //   );
  //   modal.show();
  // }, []);





  // Helper to load an ArrayBuffer (from fetch or file reader) and process it
  const loadExcelBuffer = async (arrayBuffer, incomingFileName = 'default.xlsx') => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      if (!jsonData || jsonData.length === 0) {
        throw new Error('Excel file is empty');
      }

      const { groupedData, rowCount } = processExcelData(jsonData);

      if (Object.keys(groupedData).length === 0) {
        throw new Error('No valid staff data found in Excel file');
      }

      setStaffData(groupedData);
      setFileName(incomingFileName);

      // Persist data and then fetch avatars for staff
      window.staffReportData = {
        data: groupedData,
        fileName: incomingFileName,
        uploadDate: new Date().toISOString(),
        avatars: window.staffReportData && window.staffReportData.avatars ? window.staffReportData.avatars : {}
      };

      // fetch avatars for each staff member (non-blocking for UX but we'll await to set state)
      const staffNames = Object.keys(groupedData);
      if (staffNames.length > 0) {
        const avatarMap = await fetchAvatarsForStaff(staffNames);
        setAvatars(avatarMap);
        window.staffReportData.avatars = avatarMap;
      }

      if (Object.keys(groupedData).length > 0) {
        setSelectedStaff(Object.keys(groupedData)[0]);
      }

      setSuccess(`Successfully loaded ${Object.keys(groupedData).length} staff member(s) with ${rowCount} total tasks`);
      setLoading(false);
    } catch (err) {
      // Only show an error if the default file was present but invalid.
      setError(err.message || 'Error processing Excel file. Please ensure it has the correct format.');
      setLoading(false);
    }
  };

  

  // Fetch a cat image URL for each staff name using TheCatAPI; returns map { staffName: imageUrl }
  const fetchAvatarsForStaff = async (staffNames) => {
    const fallback = `${process.env.PUBLIC_URL || ''}/images/catlogo.gif`;
    const endpoint = 'https://api.thecatapi.com/v1/images/search';
    const apiKey = 'live_hnSc5u8DgsWFquGj5R7FDmJ8hgjMrY3iRck36HFouwJqJTSGlURvaHiFb7ee7oiD'; // Optional: insert your TheCatAPI key here if you have one

    const promises = staffNames.map(async () => {
      try {
        const resp = await fetch(endpoint, {
          headers: {
            'x-api-key': apiKey
          }
        });

        if (!resp.ok) return fallback;
        const json = await resp.json();
        if (Array.isArray(json) && json[0] && json[0].url) return json[0].url;
        return fallback;
      } catch (e) {
        return fallback;
      }
    });

    const results = await Promise.all(promises);
    const map = {};
    staffNames.forEach((name, idx) => {
      map[name] = results[idx];
    });
    return map;
  };

  // apply theme class to document root and persist
  useEffect(() => {
    try {
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', theme);
    } catch (e) {
      // ignore in non-browser env
    }
  }, [theme]);

  // Handler to load the default Excel from public/default.xlsx when the user requests it
  const handleLoadDefault = async () => {
    const defaultPath = `${process.env.PUBLIC_URL || ''}/default.xlsx`;
    try {
      setError('');
      setSuccess('');
      setLoading(true);
      const resp = await fetch(defaultPath);
      if (!resp.ok) {
        setLoading(false);
        setError('Default file not found. Place a file at public/default.xlsx to enable this option.');
        return;
      }

      const buffer = await resp.arrayBuffer();
      await loadExcelBuffer(buffer, 'default.xlsx');
    } catch (err) {
      setError(err && err.message ? err.message : String(err));
      setLoading(false);
    }
  };

  const processExcelData = (data) => {
    const groupedData = {};
    let rowCount = 0;
    
    data.forEach(row => {
      const staffName = row['Staff/Position'];
      if (!staffName || staffName.trim() === '') return;
      
      if (!groupedData[staffName]) {
        groupedData[staffName] = [];
      }
      
      groupedData[staffName].push({
        mfo: row['MFO'] || row['mfo'] || '',
        category: row['Major Category'] || '',
        tor: row['Task/Terms of Reference (ToR)'] || '',
        effectiveness: row['E: Measure of Effectiveness (Numeric Output)'] || '',
        quality: row['Q: Measure of Quality'] || '',
        time: row['T: Measure of Time (Updated per request)'] || '',
        area: row['Area'] || row['Areas'] || '',
        chargingCode: row['Charging Code'] || ''
      });
      rowCount++;
    });
    
    return { groupedData, rowCount };
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setSuccess('');

    const reader = new FileReader();
    reader.onload = (e) => {
      // reuse loadExcelBuffer to handle parsing + avatar fetching
      loadExcelBuffer(e.target.result, file.name);
    };

    reader.onerror = () => {
      setError('Error reading file. Please try again.');
      setLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const organizeDataByMFO = (tasks) => {
    const organized = {};
    
    tasks.forEach(task => {
      const mfo = task.mfo || 'Uncategorized';
      if (!organized[mfo]) {
        organized[mfo] = {};
      }
      
      const category = task.category || 'Uncategorized';
      if (!organized[mfo][category]) {
        organized[mfo][category] = [];
      }
      
      organized[mfo][category].push(task);
    });
    
    return organized;
  };

  const generateWordDocument = (staffName, tasks) => {
    const dateStr = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const organized = organizeDataByMFO(tasks);

    let html = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset="UTF-8">
    <title>Performance Report2 - ${staffName}</title>
    <style>
      @page WordSection1 {
          size: 21cm 29.7cm;
          margin: 0.2in 0.5in 0.75in 1in; /* top, right, bottom, left */
          mso-header: h1;
          mso-header-margin: 0.5in;
      }
    
      div.WordSection1 {
      page: WordSection1;
      } 

      body { 
          font-family: 'Cambria', serif; 
          line-height: 1.1;
          font-size: 10pt;
          color: #000;
          margin: 0;
          padding: 0

      }

      .doc-content {
        margin-top: 0.5in;
        padding: 0;}


      table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 1px 0;
          table-layout: fixed;
      }
      th { 
          background-color: #d9d9d9;  /* light gray */
          color: #000;
          padding: 1px 5px;  /* smaller padding to reduce row height */
          text-align: left;
          font-weight: bold;
          border: 1px solid #000;
          font-size: 12pt;  /* header font size */
          font-family: 'Cambria', serif;
          line-height: 1;
      }
      td { 
          padding: 1px 5px;
          border: 1px solid #999;
          vertical-align: top;
          font-size: 10pt;
          font-family: 'Cambria', serif;
          line-height: 1;
      }
      .mfo-header {
          background-color: #bfbfbf;
          color: #000;
          font-weight: bold;
          border: 1px solid #000;
          padding: 1px 5px;
          font-size: 12pt;
          text-align: left;
          font-family: 'Cambria', serif;
      }
      .category-header {
          background-color: #e6e6e6;
          color: #000;
          border: 1px solid #000;
          font-weight: bold;
          padding: 1px 5px;
          font-size: 11pt;
          font-family: 'Cambria', serif;
          font-style: italic;
      }
      .indicator-cell {
          background-color: #f2f2f2;
          font-weight: 600;
          width: 15%;
      }
      .footer {
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #ddd;
          color: #555;
          font-size: 10pt;
          font-family: 'Cambria', serif;
      }
      .header {
          text-align: center;
          font-weight: bold;
          font-style: italic;
          font-size: 12pt;
          font-family: 'Cambria', serif;
      }
        /* Explicit classes for the small columns */
      td.area-cell, th.area-cell,
      td.charge-cell, th.charge-cell {
          font-size: 8.5pt; /* smaller size for Areas & Charging Code */
          font-style: normal; /* or 'italic' if you prefer */
          text-align: center;
          padding: 2px 3px;
      }

    </style>
</head>
<body>

    <div class="WordSection1">

      <!--[if gte mso 9]> 
      <div style="mso-element:header" id="h1">
        <p style="text-align:center; font-family:'Cambria',serif; font-style:italic; font-size:12pt; margin:0; padding-top:6px; padding-bottom:6px;">
        ANNEX A
        </p>
      </div>
      <![endif]-->

      <!-- Visible heading for non-Word viewers. Word will use the running header above. mso-hide:all tells Word to hide this element (prevents duplicate on first page). -->
      <div style="text-align:center; font-family:'Cambria',serif; font-style:italic; font-size:12pt; margin:0 0 12px 0; mso-hide:all;">
         ANNEX A
      </div>



      <div class="doc-content">
        <table border="1" cellspacing="0" cellpadding="">
            <thead>
                <tr>
                    <th width="35%">Terms of Reference</th>
                    <th width="35%">Success Indicator</th>
                    <th width="10%">Area</th>
                    <th width="20%">Charging Code</th>
                </tr>
            </thead>
            <tbody>`;

        Object.keys(organized).forEach(mfo => {
          html += `
                <tr>
                    <td colspan="4" class="mfo-header">${mfo}</td>
                </tr>`;
          
          Object.keys(organized[mfo]).forEach(category => {
            html += `
                <tr>
                    <td colspan="4" class="category-header">${category}</td>
                </tr>`;
            
            organized[mfo][category].forEach(task => {
              html += `
                <tr>
                    <td rowspan="3">${task.tor}</td>
                    <td>E: ${task.effectiveness}</td>
                    <td class="area-cell" rowspan="3">${task.area}</td>
                    <td class="charge-cell" rowspan="3">${task.chargingCode}</td>
                </tr>
                <tr>
                    <td>Q: ${task.quality}</td>
                </tr>
                <tr>
                    <td>T: ${task.time}</td>
                </tr>`;
            });
          });
        });

        html += `
            </tbody>
        </table>
      </div>  
      <div class="footer">
          Generated on: ${dateStr}
      </div>
    </div>  
</body>
</html>`;
    
    return html;
  };

  const downloadAsWord = (staffName, tasks) => {
    const htmlContent = generateWordDocument(staffName, tasks);
    const blob = new Blob(['\ufeff', htmlContent], { 
      type: 'application/msword' 
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${staffName.replace(/[^a-z0-9]/gi, '_')}_Report.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    setSuccess(`Word report downloaded successfully for ${staffName}`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const downloadAsExcel = (staffName, tasks) => {
    const organized = organizeDataByMFO(tasks);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');

    // Setup columns
    sheet.columns = [
      { header: 'Terms of Reference', key: 'tor', width: 50 },
      { header: 'Success Indicator', key: 'indicator', width: 60 },
      { header: 'Area', key: 'area', width: 18 },
      { header: 'Charging Code', key: 'charge', width: 20 }
    ];

    // Header row styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { name: 'Cambria', size: 12, bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Start writing from row 2
    let rowIndex = 2;

    Object.keys(organized).forEach(mfo => {
      // MFO row - merge across 4 columns
      sheet.mergeCells(rowIndex, 1, rowIndex, 4);
      const mfoRow = sheet.getRow(rowIndex);
      mfoRow.getCell(1).value = mfo;
      mfoRow.getCell(1).font = { name: 'Cambria', size: 12, bold: true };
      mfoRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } };
      mfoRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      mfoRow.eachCell(cell => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });
      rowIndex++;

      Object.keys(organized[mfo]).forEach(category => {
        // Category row - merge across 4 columns
        sheet.mergeCells(rowIndex, 1, rowIndex, 4);
        const catRow = sheet.getRow(rowIndex);
        catRow.getCell(1).value = category;
        catRow.getCell(1).font = { name: 'Cambria', size: 11, bold: true, italic: true };
        catRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } };
        catRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        catRow.eachCell(cell => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });
        rowIndex++;

        organized[mfo][category].forEach(task => {
          // E row (TOR, Indicator, Area, Charge) - will be merged vertically over 3 rows
          sheet.getRow(rowIndex).getCell(1).value = task.tor;
          sheet.getRow(rowIndex).getCell(2).value = `E: ${task.effectiveness}`;
          sheet.getRow(rowIndex).getCell(3).value = task.area;
          sheet.getRow(rowIndex).getCell(4).value = task.chargingCode;

          // Q row
          sheet.getRow(rowIndex + 1).getCell(2).value = `Q: ${task.quality}`;

          // T row
          sheet.getRow(rowIndex + 2).getCell(2).value = `T: ${task.time}`;

          // merge TOR (col1), Area (col3), Charge (col4) vertically across 3 rows
          sheet.mergeCells(rowIndex, 1, rowIndex + 2, 1);
          sheet.mergeCells(rowIndex, 3, rowIndex + 2, 3);
          sheet.mergeCells(rowIndex, 4, rowIndex + 2, 4);

          // Style the three rows
          for (let rr = 0; rr < 3; rr++) {
            const r = sheet.getRow(rowIndex + rr);
            r.height = 18; // base height; Excel auto-fit will still be used by client
            r.getCell(1).font = { name: 'Cambria', size: 10 };
            r.getCell(2).font = { name: 'Cambria', size: 10 };
            r.getCell(3).font = { name: 'Cambria', size: 10 };
            r.getCell(4).font = { name: 'Cambria', size: 10 };
            r.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            r.eachCell(cell => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });
          }

          // indicator cell fill for rowIndex (E), rowIndex+1 (Q), rowIndex+2 (T)
          sheet.getRow(rowIndex).getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          sheet.getRow(rowIndex + 1).getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          sheet.getRow(rowIndex + 2).getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

          rowIndex += 3;
        });
      });
    });

    // Auto-filter and some final column sizing (exceljs doesn't have perfect auto-fit; this approximates)
    sheet.views = [{ state: 'normal', showGridLines: true }];

    // Create buffer and trigger download in browser
    workbook.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${staffName.replace(/[^a-z0-9]/gi, '_')}_Report.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSuccess(`Excel report downloaded successfully for ${staffName}`);
      setTimeout(() => setSuccess(''), 3000);
    }).catch(err => {
      setError('Error generating Excel file: ' + (err && err.message ? err.message : String(err)));
    });
  };

  const downloadAsHTML = (staffName, tasks) => {
    const dateStr = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const organized = organizeDataByMFO(tasks);

    let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Performance Report - ${staffName}</title>
    <style>
        body { 
            font-family: 'Calibri', Arial, sans-serif; 
            margin: 40px;
            line-height: 1.6;
        }
        h1 { 
            color: #2c3e50; 
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        th { 
            background-color: #3498db; 
            color: white; 
            padding: 12px; 
            text-align: left;
            font-weight: bold;
            border: 1px solid #2980b9;
        }
        td { 
            padding: 10px; 
            border: 1px solid #ddd;
            vertical-align: top;
        }
        .mfo-header {
            background-color: #34495e;
            color: white;
            font-weight: bold;
            padding: 12px;
            font-size: 1.1em;
        }
        .category-header {
            background-color: #7f8c8d;
            color: white;
            font-weight: bold;
            padding: 10px;
        }
        tr:hover { 
            background-color: #e8f4f8; 
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #7f8c8d;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>Performance Report: ${staffName}</h1>
    <table>
        <thead>
            <tr>
                <th style="width: 25%;">Terms of Reference</th>
                <th style="width: 40%;">Success Indicator</th>
                <th style="width: 20%;">Area</th>
                <th style="width: 15%;">Charging Code</th>
            </tr>
        </thead>
        <tbody>`;

    Object.keys(organized).forEach(mfo => {
      html += `
            <tr>
                <td colspan="4" class="mfo-header">${mfo}</td>
            </tr>`;
      
      Object.keys(organized[mfo]).forEach(category => {
        html += `
            <tr>
                <td colspan="4" class="category-header">${category}</td>
            </tr>`;
        
        organized[mfo][category].forEach(task => {
          html += `
            <tr>
                <td rowspan="3">${task.tor}</td>
                <td>E: ${task.effectiveness}</td>
                <td rowspan="3">${task.area}</td>
                <td rowspan="3">${task.chargingCode}</td>
            </tr>
            <tr>
                <td>Q: ${task.quality}</td>
            </tr>
            <tr>
                <td>T: ${task.time}</td>
            </tr>`;
        });
      });
    });

    html += `
        </tbody>
    </table>
    <div class="footer">
        Generated on: ${dateStr}
    </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${staffName.replace(/[^a-z0-9]/gi, '_')}_Report.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const currentTasks = selectedStaff ? staffData[selectedStaff] : [];
  const staffList = Object.keys(staffData).sort();
  // Scrollable report table (no pagination) — table itself scrolls vertically within right column
  const PaginatedReportTable = ({ tasks }) => {
    const organizedLocal = organizeDataByMFO(tasks);
    const rows = [];
    Object.keys(organizedLocal).forEach(mfo => {
      rows.push({ type: 'mfo', text: mfo });
      Object.keys(organizedLocal[mfo]).forEach(category => {
        rows.push({ type: 'category', text: category });
        organizedLocal[mfo][category].forEach(task => {
          rows.push({ type: 'task', task });
          rows.push({ type: 'q', task });
          rows.push({ type: 't', task });
        });
      });
    });

    return (
      <div className="w-full h-full">
        <div className="h-full">
          <table className="w-full table-fixed border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900">
            <thead style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }} className="dark:shadow-none">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider dark:text-white"
                  style={{ width: '35%', background: 'linear-gradient(90deg,#1e3a8a,#4f46e5)', position: 'sticky', top: 0, zIndex: 70 }}
                >
                  Terms of Reference
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider dark:text-white"
                  style={{ width: '35%', background: 'linear-gradient(90deg,#1e3a8a,#4f46e5)', position: 'sticky', top: 0, zIndex: 70 }}
                >
                  Success Indicator
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider dark:text-white"
                  style={{ width: '15%', background: 'linear-gradient(90deg,#1e3a8a,#4f46e5)', position: 'sticky', top: 0, zIndex: 70 }}
                >
                  Area
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider dark:text-white"
                  style={{ width: '15%', background: 'linear-gradient(90deg,#1e3a8a,#4f46e5)', position: 'sticky', top: 0, zIndex: 70 }}
                >
                  Charging Code
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900">
              {rows.map((r, idx) => {
                if (r.type === 'mfo') {
                  return (
                    <tr key={`mfo-${idx}`}>
                      <td colSpan={4} className="px-4 py-2 bg-gray-800 text-white font-bold text-sm dark:bg-gray-700">{r.text}</td>
                    </tr>
                  );
                }

                if (r.type === 'category') {
                  return (
                    <tr key={`cat-${idx}`}>
                      <td colSpan={4} className="px-4 py-2 bg-gray-600 text-white font-semibold text-sm dark:bg-gray-600">{r.text}</td>
                    </tr>
                  );
                }

                if (r.type === 'task') {
                  return (
                    <tr key={`task-${idx}`} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-3 align-top text-sm text-gray-800 dark:text-gray-100">{r.task.tor}</td>
                      <td className="px-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-200"><span className="font-semibold">E:</span> {r.task.effectiveness}</td>
                      <td className="px-4 py-3 align-top text-sm text-gray-800 dark:text-gray-100">{r.task.area}</td>
                      <td className="px-4 py-3 align-top text-sm text-gray-800 dark:text-gray-100">{r.task.chargingCode}</td>
                    </tr>
                  );
                }

                if (r.type === 'q') {
                  return (
                    <tr key={`q-${idx}`} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2 text-sm"></td>
                      <td className="px-4 py-2 text-sm dark:text-gray-200"><span className="font-semibold">Q:</span> {r.task.quality}</td>
                      <td className="px-4 py-2 text-sm"></td>
                      <td className="px-4 py-2 text-sm"></td>
                    </tr>
                  );
                }

                if (r.type === 't') {
                  return (
                    <tr key={`t-${idx}`} className="border-b-2 border-gray-300 dark:border-gray-700">
                      <td className="px-4 py-2 text-sm"></td>
                      <td className="px-4 py-2 text-sm dark:text-gray-200"><span className="font-semibold">T:</span> {r.task.time}</td>
                      <td className="px-4 py-2 text-sm"></td>
                      <td className="px-4 py-2 text-sm"></td>
                    </tr>
                  );
                }

                return null;
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen min-w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8 overflow-hidden relative dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            {/* Welcome Modal */}
        {showWelcomeModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowWelcomeModal(false)}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[70vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    🐾 Staff ANNEX A Generator
                  </h1>
                  <button
                    onClick={() => setShowWelcomeModal(false)}
                    className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
                <p className="text-blue-100 italic mt-2">
                  "I'm not even sure I really need this web app, but I built it anyway…"
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {/* All content sections here */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <p className="text-gray-700">
                    Though wala akong spare time, I used my <strong>procrastination powers</strong> to delay real deadlines and create this nonsense (but actually useful) app — para magawa ko ang <strong>ANNEX A</strong> ng team. YEY.
                  </p>
                </div>

                  <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                    🧩 About the App
                  </h2>
                  <p className="text-gray-700 mb-3">
                    The <strong>Staff ANNEX A Generator</strong> is a lightweight web tool that helps automate the creation and formatting of <strong>ANNEX A</strong> files for staff members.
                  </p>
                  <p className="text-gray-700 mb-2">It allows users to:</p>
                  <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                    <li>View their TOR (Terms of Reference) data for a specific period (default: <strong>January–June 2026</strong>)</li>
                    <li>Download formatted reports as <strong>Word (.docx)</strong> or <strong>Excel (.xlsx)</strong> files</li>
                    <li>Optionally upload their own TOR data file</li>
                  </ul>
                  <p className="text-gray-700 mt-3">
                    And yes — <strong>random cats</strong> will appear throughout the app. They're completely irrelevant to the tool's function, but undeniably <strong>cute</strong> 😸
                  </p>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                    🛠️ Built With
                  </h2>
                  <p className="text-gray-700 mb-2">This app was made with:</p>
                  <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                    <li><strong>React</strong> — Frontend framework</li>
                    <li><strong>JavaScript (ES6+)</strong> — Core programming language</li>
                    <li><strong>XLSX</strong> — For reading and exporting Excel files</li>
                    <li><strong>Tailwind CSS</strong> — For UI styling</li>
                    <li><strong>TheCatAPI</strong> — For fetching adorable (and irrelevant) cat images</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                    📘 Instructions
                  </h2>
                  <p className="text-gray-700 mb-3">
                    By default, the app already includes <strong>TOR data for January to June 2026</strong>. You can navigate and explore your respective TORs by selecting your <strong>name</strong> under <em>Staff Member</em> — the corresponding table will be displayed on the right.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-800 font-semibold mb-2">💾 You can:</p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                      <li><strong>Download as Word (.docx)</strong> → This is the version you'll submit to <em>Rain</em> 😅</li>
                      <li><strong>Download as Excel (.xlsx)</strong> → For your personal records or edits</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                    📤 Uploading Your Own TOR File
                  </h2>
                  <p className="text-gray-700 mb-3">
                    If you want to use your own data, you can upload an Excel file (<code className="bg-gray-100 px-2 py-1 rounded">.xlsx</code> or <code className="bg-gray-100 px-2 py-1 rounded">.xls</code>) that includes the following variables:
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-300 text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Variable</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td className="border border-gray-300 px-3 py-2"><strong>Staff / Position</strong></td><td className="border border-gray-300 px-3 py-2">Name and position of the staff member</td></tr>
                        <tr><td className="border border-gray-300 px-3 py-2"><strong>MFO</strong></td><td className="border border-gray-300 px-3 py-2">Major Final Output</td></tr>
                        <tr><td className="border border-gray-300 px-3 py-2"><strong>Major Category</strong></td><td className="border border-gray-300 px-3 py-2">Task classification</td></tr>
                        <tr><td className="border border-gray-300 px-3 py-2"><strong>Task / Terms of Reference (ToR)</strong></td><td className="border border-gray-300 px-3 py-2">Description of activity</td></tr>
                        <tr><td className="border border-gray-300 px-3 py-2"><strong>E: Measure of Effectiveness</strong></td><td className="border border-gray-300 px-3 py-2">Numeric output measure</td></tr>
                        <tr><td className="border border-gray-300 px-3 py-2"><strong>Q: Measure of Quality</strong></td><td className="border border-gray-300 px-3 py-2">Quality criteria or description</td></tr>
                        <tr><td className="border border-gray-300 px-3 py-2"><strong>T: Measure of Time</strong></td><td className="border border-gray-300 px-3 py-2">Timeliness measure (updated per request)</td></tr>
                        <tr><td className="border border-gray-300 px-3 py-2"><strong>Areas</strong></td><td className="border border-gray-300 px-3 py-2">Focus areas or regions</td></tr>
                        <tr><td className="border border-gray-300 px-3 py-2"><strong>Charging Code</strong></td><td className="border border-gray-300 px-3 py-2">Code or budget reference</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-3 rounded">
                    <p className="text-sm text-gray-700">
                      ⚠️ <strong>Disclaimer:</strong> Di ko pa natest if may kulang sa variables na yan hehe 😅
                    </p>
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                    🐱 Fun but Useless Feature
                  </h2>
                  <blockquote className="border-l-4 border-gray-400 pl-4 italic text-gray-700 mb-3">
                    "AS usual, random cats will be seen on this web app."
                  </blockquote>
                  <p className="text-gray-700">
                    The app randomly loads images from <strong>TheCatAPI</strong>. They serve <em>absolutely no purpose</em> other than to make the experience more enjoyable.
                  </p>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                    🧑‍💻 Developer Notes
                  </h2>
                  <p className="text-gray-700 mb-3">
                    This project was built out of <strong>procrastination</strong>, <strong>necessity</strong>, and <strong>cat appreciation</strong>.
                  </p>
                  <p className="text-gray-700 mb-3">
                    ALSO <strong>Big Thanks</strong> to AI Friends (Claude, ChatGPT) for helping me code this app.
                  </p>
                </div>

                <div className="border-t pt-4">
                  <h2 className="text-xl font-bold text-gray-800 mb-2">🪄 Future Plans</h2>
                  <p className="text-gray-700">
                    No plans. This may be abandoned. Except when looking for cats. Or next contract
                  </p>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg text-center">
                  <p className="text-gray-700 font-semibold">Created by: Nefriend Francisco</p>
                  <p className="text-gray-600 text-sm">PhilRice Data Analytics Center - Analytics Unit</p>
                </div>


                <div className="flex justify-center pb-4">
                  <button
                    onClick={() => setShowWelcomeModal(false)}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    Let's Get Started! 🚀
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      
      
      
      {/* Moving cats background (non-interactive) */}
      <div className="moving-cats pointer-events-none absolute inset-0 z-0">
        <div className="cat cat1" style={{ fontSize: '2rem', top: '6%', animationDuration: '9s' }}>🐱</div>
        <div className="cat cat2" style={{ fontSize: '2.1rem', top: '22%', animationDuration: '7.5s' }}>😸</div>
        <div className="cat cat3" style={{ fontSize: '1.9rem', top: '38%', animationDuration: '10s' }}>😺</div>
        <div className="cat cat4" style={{ fontSize: '2.2rem', top: '62%', animationDuration: '8.5s' }}>😻</div>
        <div className="cat cat5" style={{ fontSize: '1.8rem', top: '16%', animationDuration: '11s' }}>🙀</div>
        <div className="cat cat6" style={{ fontSize: '2rem', top: '54%', animationDuration: '8s' }}>😹</div>
        <div className="cat cat7" style={{ fontSize: '2.4rem', top: '12%', animationDuration: '12s', animationDelay: '1s' }}>🐈‍⬛</div>
        <div className="cat cat8" style={{ fontSize: '2rem', top: '34%', animationDuration: '9.5s', animationDelay: '2s' }}>🐯</div>
        <div className="cat cat9" style={{ fontSize: '1.9rem', top: '44%', animationDuration: '7s', animationDelay: '0.5s' }}>😼</div>
        <div className="cat cat10" style={{ fontSize: '2.1rem', top: '72%', animationDuration: '10s', animationDelay: '3s' }}>😽</div>
        <div className="cat cat11" style={{ fontSize: '1.8rem', top: '26%', animationDuration: '8.2s', animationDelay: '2.5s' }}>😿</div>
        <div className="cat cat12" style={{ fontSize: '2rem', top: '66%', animationDuration: '9s', animationDelay: '4s' }}>😺</div>
      </div>

      <style>{`
        .moving-cats { position: absolute; inset: 0; overflow: hidden; }
        .moving-cats .cat { position: absolute; animation-duration: 8s; animation-iteration-count: infinite; animation-timing-function: linear; z-index: 1; }
        .moving-cats .cat1 { animation-name: float1; left: -8%; }
        .moving-cats .cat2 { animation-name: float2; right: -8%; }
        .moving-cats .cat3 { animation-name: float3; left: -8%; }
        .moving-cats .cat4 { animation-name: float4; right: -8%; }
        .moving-cats .cat5 { animation-name: float5; left: -8%; }
        .moving-cats .cat6 { animation-name: float6; right: -8%; }
        .moving-cats .cat7 { animation-name: float2; left: -8%; }
        .moving-cats .cat8 { animation-name: float4; right: -8%; }
        .moving-cats .cat9 { animation-name: float1; left: -8%; }
        .moving-cats .cat10 { animation-name: float3; right: -8%; }
        .moving-cats .cat11 { animation-name: float5; left: -8%; }
        .moving-cats .cat12 { animation-name: float6; right: -8%; }

        @keyframes float1 { 0% { left: -8%; transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.05); } 100% { left: 108%; transform: rotate(360deg) scale(1); } }
        @keyframes float2 { 0% { right: -8%; transform: rotate(0deg) scaleX(-1); } 50% { transform: rotate(-180deg) scaleX(-1); } 100% { right: 108%; transform: rotate(-360deg) scaleX(-1); } }
        @keyframes float3 { 0% { left: -8%; transform: rotate(0deg); } 25% { transform: rotate(90deg); } 50% { transform: rotate(180deg); } 75% { transform: rotate(270deg); } 100% { left: 108%; transform: rotate(360deg); } }
        @keyframes float4 { 0% { right: -8%; transform: rotate(0deg) scaleX(-1); } 33% { transform: rotate(-120deg) scaleX(-1); } 66% { transform: rotate(-240deg) scaleX(-1); } 100% { right: 108%; transform: rotate(-360deg) scaleX(-1); } }
        @keyframes float5 { 0% { left: -8%; transform: translateY(0px) rotate(0deg); } 25% { transform: translateY(-20px) rotate(90deg); } 50% { transform: translateY(0px) rotate(180deg); } 75% { transform: translateY(20px) rotate(270deg); } 100% { left: 108%; transform: translateY(0px) rotate(360deg); } }
        @keyframes float6 { 0% { right: -8%; transform: translateY(0px) rotate(0deg) scaleX(-1); } 20% { transform: translateY(-30px) rotate(-72deg) scaleX(-1); } 40% { transform: translateY(10px) rotate(-144deg) scaleX(-1); } 60% { transform: translateY(-10px) rotate(-216deg) scaleX(-1); } 80% { transform: translateY(20px) rotate(-288deg) scaleX(-1); } 100% { right: 108%; transform: translateY(0px) rotate(-360deg) scaleX(-1); } }

        .max-w-7xl, .max-w-7xl * { position: relative; z-index: 2; }
      `}</style>

      <div className="max-w-7xl mx-auto h-[92vh] flex gap-6">
        <div className="w-1/3 bg-white rounded-2xl shadow-2xl p-6 md:p-8 overflow-hidden dark:bg-gray-800 dark:shadow-none">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-0">
              <img src={`${process.env.PUBLIC_URL}/images/catlogo.gif`} alt="App Logo" className="w-50 h-50 xl:w-100 xl:h-100 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">Staff ANNEX A Generator</h1>
              <p className="text-gray-600 text-sm mt-1 dark:text-gray-300">"I'm not even sure I really need this web-app, but I built it anyway.."</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <Upload className="w-4 h-4 inline mr-2" />
              Upload Excel File of TORs here (XLSX/XLS)
            </label>
            <div className="relative">
              <div className="mb-3">
                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={loading} className="w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer file:transition-colors cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>

              <div className="flex items-center gap-3">
                <button type="button" onClick={handleLoadDefault} disabled={loading} title="Load bundled default.xlsx from public folder" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-semibold">Load default.xlsx</button>
                <p className="text-sm text-gray-600">Or click to load the bundled <span className="font-semibold">default.xlsx</span> from the app's public folder.</p>
              </div>
            </div>
            {fileName && (
              <p className="mt-2 text-sm text-gray-600 flex items-center gap-2 dark:text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Current file: <span className="font-semibold">{fileName}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3 dark:bg-red-900 dark:text-red-100">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg flex items-start gap-3 dark:bg-green-900 dark:text-green-100">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Success</p>
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg dark:bg-blue-900 dark:text-blue-100">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                Processing Excel file...
              </p>
            </div>
          )}

          {staffList.length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="block mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <User className="w-4 h-4 inline mr-2" />
                Select Staff Member ({staffList.length} total)
              </label>
              <select value={selectedStaff} onChange={(e) => { setSelectedStaff(e.target.value); }} className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-700 font-medium">
                {staffList.map(staff => (<option key={staff} value={staff}>{staff}</option>))}
              </select>
            </div>
          )}
        </div>

        <div className="w-2/3 bg-white rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col min-h-0 dark:bg-gray-800 dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                <div className="flex items-center gap-3">
                  <img src={selectedStaff && avatars[selectedStaff] ? avatars[selectedStaff] : `${process.env.PUBLIC_URL}/images/catlogo.gif`} alt={selectedStaff ? `${selectedStaff} avatar` : 'avatar'} className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md" />
                </div>
                {selectedStaff || 'No staff selected'}
              </h2>
              <p className="text-sm text-gray-600 mt-1 dark:text-gray-300">{currentTasks.length} task{currentTasks.length !== 1 ? 's' : ''} assigned</p>
            </div>

            <div className="flex gap-3 items-center">
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme" className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-sm text-gray-800 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100">{theme === 'dark' ? 'Light' : 'Dark'}</button>
              <div className="h-0 w-2" />
              <div className="flex gap-3">
                <button onClick={() => downloadAsHTML(selectedStaff, currentTasks)} className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-xl">HTML</button>
                <button onClick={() => downloadAsExcel(selectedStaff, currentTasks)} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-xl">Excel</button>
                <button onClick={() => downloadAsWord(selectedStaff, currentTasks)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl">Word</button>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto relative">
            <div className="w-full relative">
              {selectedStaff && currentTasks.length > 0 ? (<PaginatedReportTable tasks={currentTasks} />) : (<div className="p-6 text-center text-gray-500 dark:text-gray-400">No report to show</div>)}
            </div>
          </div>
        </div>
      </div>

      

    </div>


  ); 
};
export default StaffReportApp;