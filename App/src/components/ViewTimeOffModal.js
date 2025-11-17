import React, { useEffect, useState } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { ModuleRegistry } from '@ag-grid-community/core';
import { API_BASE_URL } from '../config';

// Register the required AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

const ViewTimeOffModal = ({ resourceId, onClose }) => {
    const [rowData, setRowData] = useState([]);

    useEffect(() => {
        const handleEsc = (event) => {
            if (event.keyCode === 27) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);

        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    useEffect(() => {
        const loadTimeOff = () => {
            const url = resourceId ? `${API_BASE_URL}/timeoff/${resourceId}` : `${API_BASE_URL}/timeoff`;
            fetch(url)
                .then(response => response.json())
                .then(data => setRowData(data))
                .catch(error => console.error('Error loading time off:', error));
        };

        loadTimeOff();
    }, [resourceId]);

    const columnDefs = [
        { headerName: 'Resource ID', field: 'resource_id' },
        { headerName: 'Colleague Name', field: 'resource_name' },
        { headerName: 'Time Off Start Date', field: 'timeoff_start_date' },
        { headerName: 'Time Off End Date', field: 'timeoff_end_date' },
        { headerName: 'Reason', field: 'reason' }
    ];

    return (
        <div className="modal fade show" style={{ display: 'block', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '75%', height: 'auto', padding: '0' }} tabIndex="-1" aria-labelledby="viewTimeoffModalLabel" aria-hidden="true">
            <div className="modal-dialog modal-lg" style={{ width: '100%', height: '100%', margin: '0' }}>
                <div className="modal-content" style={{ width: '100%', height: '100%', border: 'none' }}>
                    <div className="modal-header" style={{ padding: '10px' }}>
                        <h5 className="modal-title" id="viewTimeoffModalLabel">Time Off</h5>
                        <button type="button" className="close" onClick={onClose} aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div className="modal-body" style={{ padding: '0' }}>
                        <div id="timeoff-grid" className="ag-theme-alpine" style={{ width: '100%', height: '100%' }}>
                            <AgGridReact
                                columnDefs={columnDefs}
                                rowData={rowData}
                                defaultColDef={{ sortable: true, filter: true, resizable: true }}
                                rowSelection="single"
                                domLayout="autoHeight"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewTimeOffModal;