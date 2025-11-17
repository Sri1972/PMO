import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from '@ag-grid-community/react';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { ModuleRegistry } from '@ag-grid-community/core';
import { API_BASE_URL } from '../config';
import { FaFileExcel, FaPaperclip } from 'react-icons/fa'; // Import FaPaperclip for download icon
import * as XLSX from 'xlsx'; // Import XLSX for Excel export
import { Tooltip } from 'antd'; // Import Tooltip

// Register the required AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

const ResourceAllocation = () => {
    const navigate = useNavigate();
    const [rowData, setRowData] = useState([]);
    const [gridApi, setGridApi] = useState(null);

    // Session storage key (same as editor)
    const SESSION_STORAGE_KEY = 'resourceAllocationEditorState';

    // Cleanup session storage when navigating away from allocation pages
    useEffect(() => {
        return () => {
            // Check if we're navigating to an allocation-related page
            const currentPath = window.location.pathname;
            const isAllocationPage = currentPath.includes('/resource-allocation-planned');
            
            // Only clear session if navigating away from allocation pages
            if (!isAllocationPage) {
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
            }
        };
    }, []);

    useEffect(() => {
        loadResourceAllocations();
    }, []);

    const loadResourceAllocations = () => {
        fetch(`${API_BASE_URL}/allocations`)
            .then(response => response.json())
            .then(data => {
                const projectMap = {};
                const resourceMap = {};

                fetch(`${API_BASE_URL}/projects`)
                    .then(response => response.json())
                    .then(projects => {
                        projects.forEach(project => {
                            projectMap[project.project_id] = project.project_name;
                        });

                        fetch(`${API_BASE_URL}/resources`)
                            .then(response => response.json())
                            .then(resources => {
                                resources.forEach(resource => {
                                    resourceMap[resource.resource_id] = resource.resource_name;
                                });

                                data.forEach(allocation => {
                                    allocation.project_name = projectMap[allocation.project_id];
                                    allocation.resource_name = resourceMap[allocation.resource_id];
                                });

                                setRowData(data);
                            })
                            .catch(error => console.error('Error loading resources:', error));
                    })
                    .catch(error => console.error('Error loading projects:', error));
            })
            .catch(error => console.error('Error loading resource allocations:', error));
    };

    const columnDefs = [
        { headerName: 'Project ID', field: 'project_id' },
        { headerName: 'Project Name', field: 'project_name' },
        { headerName: 'Colleague Name', field: 'resource_name' },
        { headerName: 'Colleague Role', field: 'resource_role' },
        { headerName: 'Colleague Type', field: 'resource_type' },
        { headerName: 'Allocation Start Date (Planned)', field: 'allocation_start_date' },
        { headerName: 'Allocation End Date (Planned)', field: 'allocation_end_date' },
        { headerName: 'Allocation Percentage (Planned)', field: 'allocation_pct' },
        { headerName: 'Allocation Hrs. Per Week (Planned)', field: 'allocation_hrs_per_week' },
        { headerName: 'Allocation Hours (Planned)', field: 'resource_hours_planned' }, // Renamed from Number of Hours
        { headerName: 'Allocation Cost (Planned)', field: 'resource_cost_planned' } 
    ];

    // Refresh grid when component mounts (in case user is coming back from editor)
    useEffect(() => {
        // Check if we're returning from the editor
        const hasReturnedFromEditor = sessionStorage.getItem('returnedFromEditor');
        if (hasReturnedFromEditor) {
            sessionStorage.removeItem('returnedFromEditor');
            loadResourceAllocations();
        }
    }, []);

    const exportToExcel = () => {
        const filteredData = [];
        gridApi.forEachNodeAfterFilterAndSort((node) => filteredData.push(node.data)); // Get filtered and sorted data

        const worksheet = XLSX.utils.json_to_sheet(filteredData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'ResourceAllocationPlanned');
        XLSX.writeFile(workbook, 'ResourceAllocationPlanned.xlsx'); // Save the file
    };

    const onGridReady = params => {
        setGridApi(params.api);
    };

    return (
        <div>
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <Tooltip title="Export Grid Data">
                    <FaFileExcel
                        onClick={exportToExcel}
                        style={{ fontSize: '25px', cursor: 'pointer', color: 'green' }}
                    />
                </Tooltip>
            </div>
            <div id="allocations-grid" className="ag-theme-alpine" style={{ width: '100%', height: '500px' }}>
                <AgGridReact
                    columnDefs={columnDefs}
                    rowData={rowData}
                    defaultColDef={{ sortable: true, filter: true, resizable: true }}
                    rowSelection="single"
                    domLayout="normal"
                    onGridReady={onGridReady}
                />
            </div>
            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button
                    className="btn btn-success"
                    onClick={() => {
                        sessionStorage.setItem('returnedFromEditor', 'true');
                        navigate('/resource-allocation-planned-editor');
                    }}
                >
                    Add/Update Resource Allocation
                </button>
                <Tooltip title="Planned Allocation Template">
                    <a href="/ExcelTemplates/Planned_Allocation.xlsx" download>
                        <FaPaperclip style={{ fontSize: '35px', cursor: 'pointer', color: 'green' }} />
                    </a>
                </Tooltip>
            </div>
        </div>
    );
};

export default ResourceAllocation;