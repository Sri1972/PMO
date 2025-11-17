import React, { useEffect, useState } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { ModuleRegistry } from '@ag-grid-community/core';
import { API_BASE_URL } from '../config';

// Register the required AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

const AddTimeOffModal = ({ onClose, selectedResource }) => {
    const [resources, setResources] = useState([]);
    const [timeOffData, setTimeOffData] = useState([]);
    const [formData, setFormData] = useState({
        resource_id: selectedResource ? selectedResource.resource_id : '',
        timeoff_start_date: '',
        timeoff_end_date: '',
        reason: 'Vacation'
    });
    const [errorMessage, setErrorMessage] = useState('');
    const [isSaveDisabled, setIsSaveDisabled] = useState(true);

    useEffect(() => {
        loadResources();
        if (selectedResource) {
            loadTimeOffData(selectedResource.resource_id);
        }
    }, [selectedResource]);

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

    const loadResources = () => {
        fetch(`${API_BASE_URL}/resources`)
            .then(response => response.json())
            .then(data => setResources(data))
            .catch(error => console.error('Error loading resources:', error));
    };

    const loadTimeOffData = (resourceId) => {
        fetch(`${API_BASE_URL}/timeoff/${resourceId}`)
            .then(response => response.json())
            .then(data => setTimeOffData(data))
            .catch(error => console.error('Error loading time off data:', error));
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData(prevFormData => ({
            ...prevFormData,
            [name]: value
        }));

        // Check for overlap when either date is updated
        if (name === 'timeoff_start_date' || name === 'timeoff_end_date') {
            const { timeoff_start_date, timeoff_end_date } = {
                ...formData,
                [name]: value
            };

            if (timeoff_start_date && timeoff_end_date && checkOverlap(timeoff_start_date, timeoff_end_date)) {
                setErrorMessage('The selected date range overlaps with an existing time off entry for this resource.');
                setIsSaveDisabled(true); // Disable save button if overlap exists
            } else if (timeoff_start_date && timeoff_end_date) {
                setErrorMessage(''); // Clear error message if no overlap
                setIsSaveDisabled(false); // Enable save button if dates are valid
            } else {
                setIsSaveDisabled(true); // Disable save button if dates are incomplete
            }
        }
    };

    const checkOverlap = (startDate, endDate) => {
        return timeOffData.some(entry => {
            const existingStart = new Date(entry.timeoff_start_date);
            const existingEnd = new Date(entry.timeoff_end_date);
            const newStart = new Date(startDate);
            const newEnd = new Date(endDate);

            return (newStart <= existingEnd && newEnd >= existingStart);
        });
    };

    const addTimeOff = async (event) => {
        event.preventDefault();

        const { timeoff_start_date, timeoff_end_date } = formData;

        if (checkOverlap(timeoff_start_date, timeoff_end_date)) {
            setErrorMessage('The selected date range overlaps with an existing time off entry for this resource.');
            return;
        }

        fetch(`${API_BASE_URL}/timeoff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(() => {
                if (typeof onClose === 'function') {
                    onClose();
                }
            })
            .catch(error => console.error('Error adding time off:', error));
    };

    const columnDefs = [
        { headerName: 'Resource ID', field: 'resource_id' },
        { headerName: 'Colleague Name', field: 'resource_name' },
        { headerName: 'Time Off Start Date', field: 'timeoff_start_date' },
        { headerName: 'Time Off End Date', field: 'timeoff_end_date' },
        { headerName: 'Reason', field: 'reason' }
    ];

    return (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-labelledby="addTimeoffModalLabel" aria-hidden="true">
            <div className="modal-dialog modal-lg">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" id="addTimeoffModalLabel">Add Time Off</h5>
                        <button type="button" className="close" onClick={onClose} aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div className="modal-body">
                        {selectedResource && (
                            <div id="timeoff-grid" className="ag-theme-alpine" style={{ width: '100%', height: '200px', marginBottom: '20px' }}>
                                <AgGridReact
                                    columnDefs={columnDefs}
                                    rowData={timeOffData}
                                    defaultColDef={{ sortable: true, filter: true, resizable: true }}
                                    rowSelection="single"
                                    domLayout="autoHeight"
                                />
                            </div>
                        )}
                        {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}
                        <form id="timeoff-form" onSubmit={addTimeOff}>
                            <div className="form-group">
                                <label htmlFor="resource_id_add_timeoff">Resource <span className="text-danger">*</span></label>
                                <select
                                    className="form-control"
                                    id="resource_id_add_timeoff"
                                    name="resource_id"
                                    value={formData.resource_id}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="" disabled>Select a resource</option>
                                    {resources.map(resource => (
                                        <option key={resource.resource_id} value={resource.resource_id}>
                                            {resource.resource_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="timeoff_start_date_add_timeoff">Time Off Start Date <span className="text-danger">*</span></label>
                                <input
                                    type="date"
                                    className="form-control"
                                    id="timeoff_start_date_add_timeoff"
                                    name="timeoff_start_date"
                                    value={formData.timeoff_start_date}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="timeoff_end_date_add_timeoff">Time Off End Date <span className="text-danger">*</span></label>
                                <input
                                    type="date"
                                    className="form-control"
                                    id="timeoff_end_date_add_timeoff"
                                    name="timeoff_end_date"
                                    value={formData.timeoff_end_date}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="reason_add_timeoff">Reason <span className="text-danger">*</span></label>
                                <select
                                    className="form-control"
                                    id="reason_add_timeoff"
                                    name="reason"
                                    value={formData.reason}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="Vacation">Vacation</option>
                                    <option value="Bank Holiday">Bank Holiday</option>
                                    <option value="Fixed Holiday">Fixed Holiday</option>
                                    <option value="Optional Holiday">Optional Holiday</option>
                                    <option value="Annual Leave">Annual Leave</option>
                                    <option value="Casual Leave">Casual Leave</option>
                                    <option value="Sick Leave">Sick Leave</option>
                                    <option value="Parental Leave">Parental Leave</option>
                                    <option value="Bereavement Leave">Bereavement Leave</option>
                                    <option value="Jury Duty">Jury Duty</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={isSaveDisabled}>Save Time Off</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddTimeOffModal;