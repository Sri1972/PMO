import React, { useState, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { ModuleRegistry } from '@ag-grid-community/core';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { FaFileExcel } from 'react-icons/fa'; // Import Excel icon
import * as XLSX from 'xlsx'; // Import XLSX for Excel export
import { Tooltip } from 'antd'; // Import Tooltip

// Register the required module
ModuleRegistry.registerModules([ClientSideRowModelModule]);

const ResourceAllocationActual = () => {
  const [rowData, setRowData] = useState([]);
  const gridRef = useRef(null); // Reference to the grid

  const columnDefs = [
    {
      headerName: 'Timesheet Data',
      headerClass: 'center-header', // Add a custom class to center the header
      children: [
        { headerName: 'Project Name', field: 'ts_project_name', sortable: true, filter: true, width: 200 },
        { headerName: 'Project Description', field: 'ts_project_description', sortable: true, filter: true, width: 250 },
        { headerName: 'Project Task', field: 'project_task', sortable: true, filter: true, width: 250 },
        { headerName: 'Colleague Name', field: 'ts_colleague_name', sortable: true, filter: true, width: 200 },
        { headerName: 'Entry Date', field: 'entry_date', sortable: true, filter: true, width: 150 },
        { headerName: 'Total Hours', field: 'total_hrs', sortable: true, filter: true, width: 120 },
        { headerName: 'Capitalization Project', field: 'capitalization_project', sortable: true, filter: true, width: 180 },
        { headerName: 'Investment Project', field: 'investment_project', sortable: true, filter: true, width: 180 },
        { headerName: 'Project Start Date', field: 'ts_project_start_date', sortable: true, filter: true, width: 150 },
        { headerName: 'Project End Date', field: 'ts_project_end_date', sortable: true, filter: true, width: 150 },
        { headerName: 'Department', field: 'department', sortable: true, filter: true, width: 150 },
        { headerName: 'Department Code', field: 'department_code', sortable: true, filter: true, width: 150 },
        { headerName: 'Project Code', field: 'project_code', sortable: true, filter: true, width: 150 },
        { headerName: 'Input File Name', field: 'input_file_name', sortable: true, filter: true, width: 200 },
      ],
    },
    { headerName: 'Project ID', field: 'project_id', sortable: true, filter: true, width: 120 },
    { headerName: 'Project Name', field: 'project_name', sortable: true, filter: true, width: 200 },
    { headerName: 'Strategic Portfolio', field: 'strategic_portfolio', sortable: true, filter: true, width: 180 },
    { headerName: 'Product Line', field: 'product_line', sortable: true, filter: true, width: 150 },
    { headerName: 'Resource ID', field: 'resource_id', sortable: true, filter: true, width: 120 },
    { headerName: 'Colleague Name', field: 'colleague_name', sortable: true, filter: true, width: 200 },
    { headerName: 'Colleague Email', field: 'colleague_email', sortable: true, filter: true, width: 200 },
    { headerName: 'Manager Name', field: 'manager_name', sortable: true, filter: true, width: 200 },
    { headerName: 'Manager Email', field: 'manager_email', sortable: true, filter: true, width: 200 },
  ];

  /*
  const fetchData = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const ts_start_date = `${currentYear}-01-01`;
      const ts_end_date = `${currentYear}-12-31`;

      const response = await fetch(
        `${API_BASE_URL}/allocations_actual?ts_start_date=${ts_start_date}&ts_end_date=${ts_end_date}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setRowData(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  */

  const exportToExcel = () => {
    const gridApi = gridRef.current.api; // Access the grid API
    const filteredData = [];
    gridApi.forEachNodeAfterFilterAndSort((node) => filteredData.push(node.data)); // Get filtered and sorted data

    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ResourceAllocationActual');
    XLSX.writeFile(workbook, 'ResourceAllocationActual.xlsx'); // Save the file
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '10px' }}>
        <Tooltip title="Export Grid Data">
            <FaFileExcel
            onClick={exportToExcel}
            style={{ fontSize: '25px', cursor: 'pointer', color: 'green' }}
            />
        </Tooltip>
      </div>
      <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
        <AgGridReact
          ref={gridRef} // Attach the grid reference
          rowData={rowData}
          columnDefs={columnDefs}
          modules={[ClientSideRowModelModule]} // Explicitly pass the module to the grid
          rowModelType="clientSide" // Explicitly set the rowModelType
          pagination={true}
          paginationPageSize={10}
        />
      </div>
    </div>
  );
};

export default ResourceAllocationActual;
