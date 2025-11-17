import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

const ResourcesModal = ({ onClose, formType }) => {
    const [strategicPortfolios, setStrategicPortfolios] = useState([]);
    const [managers, setManagers] = useState([]);
    const [uniqueManagerNames, setUniqueManagerNames] = useState([]);
    const [resourceRoles, setResourceRoles] = useState([]);
    const [businessLines, setBusinessLines] = useState([]);
    const [filteredBusinessLines, setFilteredBusinessLines] = useState([]);
    const [formData, setFormData] = useState({
        resource_name: '',
        resource_email: '',
        resource_type: 'Employee',
        strategic_portfolio: '',
        product_line: '',
        manager_name: '',
        manager_email: '',
        resource_role: '',
        responsibility: '',
        skillset: '',
        comments: '',
        yearly_capacity: 1664,
        timesheet_colleague_name: ''
    });
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        loadStrategicPortfolios();
        loadManagers();
        loadResourceRoles();
        loadBusinessLines();

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

    const loadStrategicPortfolios = () => {
        fetch(`${API_BASE_URL}/strategic_portfolios`)
            .then(response => response.json())
            .then(data => setStrategicPortfolios(data))
            .catch(error => console.error('Error loading strategic portfolios:', error));
    };

    const loadManagers = () => {
        fetch(`${API_BASE_URL}/managers`)
            .then(response => response.json())
            .then(data => {
                setManagers(data);
                const uniqueNames = Array.from(new Set(data.map(manager => manager.manager_name)));
                setUniqueManagerNames(uniqueNames);
            })
            .catch(error => console.error('Error loading managers:', error));
    };

    const loadResourceRoles = () => {
        fetch(`${API_BASE_URL}/resource_roles`)
            .then(response => response.json())
            .then(data => setResourceRoles(data))
            .catch(error => console.error('Error loading resource roles:', error));
    };

    const loadBusinessLines = () => {
        fetch(`${API_BASE_URL}/business_lines`)
            .then(response => response.json())
            .then(data => setBusinessLines(data))
            .catch(error => console.error('Error loading business lines:', error));
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData(prevFormData => ({
            ...prevFormData,
            [name]: value
        }));
    };

    const handleManagerNameChange = (event) => {
        const managerName = event.target.value;
        setFormData(prevFormData => ({
            ...prevFormData,
            manager_name: managerName,
            manager_email: '' // Reset manager email when manager name changes
        }));
    };

    const addResource = (event) => {
        event.preventDefault();
        fetch(`${API_BASE_URL}/resources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        if (errorData.error && errorData.error.includes('Duplicate entry')) {
                            setErrorMessage(`${formData.resource_name} with ${formData.resource_email} already exists.`);
                        } else {
                            setErrorMessage('An error occurred while adding the resource.');
                        }
                        document.getElementById('resourceModal').scrollTop = 0; // Scroll to the top of the modal
                        document.getElementById('error-message').scrollIntoView({ behavior: 'smooth' }); // Scroll to the error message
                        throw new Error('Network response was not ok');
                    });
                }
                return response.json();
            })
            .then(() => {
                onClose();
                setErrorMessage(''); // Clear any previous error messages
            })
            .catch(error => console.error('Error adding resource:', error));
    };

    // Filter business lines when strategic_portfolio changes
    useEffect(() => {
        if (formData.strategic_portfolio) {
            setFilteredBusinessLines(
                businessLines.filter(
                    bl => bl.strategic_portfolio === formData.strategic_portfolio
                )
            );
            // Reset product_line if not in filtered list
            setFormData(prevFormData => ({
                ...prevFormData,
                product_line: ''
            }));
        } else {
            setFilteredBusinessLines([]);
            setFormData(prevFormData => ({
                ...prevFormData,
                product_line: ''
            }));
        }
        // eslint-disable-next-line
    }, [formData.strategic_portfolio, businessLines]);

    return (
        <div id="resourceModal" className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-labelledby="resourceModalLabel" aria-hidden="true">
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" id="resourceModalLabel">{formType === 'add' ? 'Add New Resource' : formType === 'timeoff' ? 'Add Timeoff' : 'View Timeoff'}</h5>
                        <button type="button" className="close" onClick={onClose} aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div className="modal-body" style={{ maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}>
                        {errorMessage && <div id="error-message" className="alert alert-danger">{errorMessage}</div>}
                        <form id="resource-form" onSubmit={addResource}>
                            <div className="form-group">
                                <label htmlFor="resource_name" className="form-label">Colleague Name <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="resource_name"
                                    name="resource_name"
                                    value={formData.resource_name}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="resource_email" className="form-label">Colleague Email <span className="text-danger">*</span></label>
                                <input
                                    type="email"
                                    className="form-control"
                                    id="resource_email"
                                    name="resource_email"
                                    value={formData.resource_email}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            {/* --- Timesheet Colleague Name field --- */}
                            <div className="form-group">
                                <label htmlFor="timesheet_colleague_name" className="form-label">Timesheet Colleague Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="timesheet_colleague_name"
                                    name="timesheet_colleague_name"
                                    value={formData.timesheet_colleague_name}
                                    onChange={handleInputChange}
                                    placeholder="Enter Timesheet Colleague Name"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="resource_type" className="form-label">Resource Type <span className="text-danger">*</span></label>
                                <select
                                    className="form-control"
                                    id="resource_type"
                                    name="resource_type"
                                    value={formData.resource_type}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="Employee">Employee</option>
                                    <option value="Contractor">Contractor</option>
                                    <option value="Consultant">Consultant</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="strategic_portfolio_radios" className="form-label">Strategic Portfolio <span className="text-danger">*</span></label>
                                <div id="strategic_portfolio_radios" className="form-check form-check-inline">
                                    {strategicPortfolios.map((item, index) => (
                                        <div key={`${item.strategic_portfolio}-${item.id}`} className={`form-check form-check-inline ${index % 2 === 0 ? 'bg-light' : 'bg-white'}`}>
                                            <input
                                                className="form-check-input"
                                                type="radio"
                                                name="strategic_portfolio"
                                                id={`portfolio_${item.strategic_portfolio}`}
                                                value={item.strategic_portfolio}
                                                checked={formData.strategic_portfolio === item.strategic_portfolio}
                                                onChange={handleInputChange}
                                                required
                                            />
                                            <label className="form-check-label" htmlFor={`portfolio_${item.strategic_portfolio}`}>{item.strategic_portfolio}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* --- Product Line Dropdown --- */}
                            <div className="form-group">
                                <label htmlFor="product_line" className="form-label">Product Line <span className="text-danger">*</span></label>
                                <select
                                    className="form-control"
                                    id="product_line"
                                    name="product_line"
                                    value={formData.product_line || ''}
                                    onChange={handleInputChange}
                                    required
                                    disabled={!formData.strategic_portfolio}
                                >
                                    <option value="" disabled>
                                        {formData.strategic_portfolio ? 'Select a Product Line' : 'Select Strategic Portfolio first'}
                                    </option>
                                    {filteredBusinessLines.map((bl, idx) => (
                                        <option key={bl.product_line} value={bl.product_line} className={idx % 2 === 0 ? 'bg-light' : 'bg-white'}>
                                            {bl.product_line}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="manager_name" className="form-label">Manager Name <span className="text-danger">*</span></label>
                                <select
                                    className="form-control"
                                    id="manager_name"
                                    name="manager_name"
                                    value={formData.manager_name}
                                    onChange={handleManagerNameChange}
                                    required
                                >
                                    <option value="" disabled>Select a manager</option>
                                    {uniqueManagerNames.map((manager_name, index) => (
                                        <option key={manager_name} value={manager_name} className={index % 2 === 0 ? 'bg-light' : 'bg-white'}>{manager_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="manager_email" className="form-label">Manager Email <span className="text-danger">*</span></label>
                                <select
                                    className="form-control"
                                    id="manager_email"
                                    name="manager_email"
                                    value={formData.manager_email}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="" disabled>Select a manager email</option>
                                    {managers
                                        .filter(manager => manager.manager_name === formData.manager_name)
                                        .map((manager, index) => (
                                            <option key={manager.manager_email} value={manager.manager_email} className={index % 2 === 0 ? 'bg-light' : 'bg-white'}>{manager.manager_email}</option>
                                        ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="resource_role" className="form-label">Colleague Role <span className="text-danger">*</span></label>
                                <select
                                    className="form-control"
                                    id="resource_role"
                                    name="resource_role"
                                    value={formData.resource_role}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="" disabled>Select a Colleague Role</option>
                                    {resourceRoles.map((role, index) => (
                                        <option key={`${role.role_name}-${role.id}`} value={role.role_name} className={index % 2 === 0 ? 'bg-light' : 'bg-white'}>{role.role_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="responsibility" className="form-label">Responsibility</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="responsibility"
                                    name="responsibility"
                                    value={formData.responsibility}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="skillset" className="form-label">Skillset</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="skillset"
                                    name="skillset"
                                    value={formData.skillset}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="comments" className="form-label">Comments</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="comments"
                                    name="comments"
                                    value={formData.comments}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="yearly_capacity" className="form-label">Yearly Capacity <span className="text-danger">*</span></label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="yearly_capacity"
                                    name="yearly_capacity"
                                    value={formData.yearly_capacity}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
                                <button type="submit" className="btn btn-primary">Add Resource</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResourcesModal;