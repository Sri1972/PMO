import React, { useEffect, useState } from 'react';
import { useDispatch } from "react-redux";
import { fetchProductLines } from '../redux/projectSlice';

const ProjectsModal = ({ strategicPortfolios, addProject, errorMessage, selectedProject, onClose }) => {
    const dispatch = useDispatch();
    const [productLines, setProductLines] = useState([]);
    const [formData, setFormData] = useState({
        project_name: '',
        strategic_portfolio: '',
        product_line: '',
        project_type: '',
        project_description: '',
        start_date_est: '',
        end_date_est: '',
        start_date_actual: '',
        end_date_actual: '',
        vitality: '',
        strategic: '',
        aim: '',
        timesheet_project_name: '',
        technology_project: '',
        revenue_est_growth_pa: '',
        revenue_est_current_year: '',
        revenue_est_current_year_plus_1: '',
        revenue_est_current_year_plus_2: '',
        revenue_est_current_year_plus_3: '',
        current_status: '',
        rag_status: '',
        comments: ''
    });

    useEffect(() => {
        if (selectedProject) {
            // Pre-populate the form with the selected project's data
            const sanitizedData = Object.keys(selectedProject).reduce((acc, key) => {
                acc[key] = selectedProject[key] === null || selectedProject[key] === undefined ? '' : selectedProject[key];
                return acc;
            }, {});
            setFormData(sanitizedData);

            // Fetch product lines for the selected strategic portfolio
            if (sanitizedData.strategic_portfolio) {
                dispatch(fetchProductLines(sanitizedData.strategic_portfolio)).then((data) => {
                    setProductLines(data.payload);
                });
            }
        } else {
            // Reset the form if no project is selected
            setFormData({
                project_name: '',
                strategic_portfolio: '',
                product_line: '',
                project_type: '',
                project_description: '',
                start_date_est: '',
                end_date_est: '',
                start_date_actual: '',
                end_date_actual: '',
                vitality: '', // Ensure vitality is reset
                strategic: '',
                aim: '',
                timesheet_project_name: '',
                technology_project: '',
                revenue_est_growth_pa: '',
                revenue_est_current_year: '',
                revenue_est_current_year_plus_1: '',
                revenue_est_current_year_plus_2: '',
                revenue_est_current_year_plus_3: '',
                current_status: '', // Ensure current_status is reset
                rag_status: '',
                comments: ''
            });
            setProductLines([]);
        }

        const handleEsc = (event) => {
            if (event.keyCode === 27) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);

        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [selectedProject, dispatch, onClose]);

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData(prevFormData => ({
            ...prevFormData,
            [name]: value
        }));
    };

    const loadProductLines = (strategicPortfolio) => {
        dispatch(fetchProductLines(strategicPortfolio)).then((data) => {
            setProductLines(data.payload);
        });
    };

    return (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-labelledby="projectModalLabel" aria-hidden="true">
            <div className="modal-dialog modal-lg">
                <div className="modal-content">
                    <div className="modal-header" style={{ justifyContent: 'center', height: '50px' }}>
                        <h5 className="modal-title" id="projectModalLabel">{selectedProject ? 'Update Project' : 'Add Project'}</h5>
                        <button type="button" className="close" onClick={onClose} aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div className="modal-body" style={{ maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}>
                        {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}
                        <form id="project-form" onSubmit={addProject}>
                            <div className="row">
                                <div className="col-md-4">
                                    <div className="form-group">
                                        <label htmlFor="project_name">Project Name <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" id="project_name" name="project_name" value={formData.project_name} onChange={handleInputChange} required style={{ width: '300px' }} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="strategic_portfolio">Strategic Portfolio <span className="text-danger">*</span></label>
                                        <select className="form-control" id="strategic_portfolio" name="strategic_portfolio" value={formData.strategic_portfolio} onChange={(e) => { handleInputChange(e); loadProductLines(e.target.value); }} required>
                                            <option value="">Select Strategic Portfolio</option>
                                            {strategicPortfolios.map((portfolio) => (
                                                <option key={portfolio.strategic_portfolio} value={portfolio.strategic_portfolio}>{portfolio.strategic_portfolio}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="product_line">Product Line <span className="text-danger">*</span></label>
                                        <select className="form-control" id="product_line" name="product_line" value={formData.product_line} onChange={handleInputChange} required>
                                            <option value="">Select Product Line</option>
                                            {productLines.map((line) => (
                                                <option key={line.product_line} value={line.product_line}>{line.product_line}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="project_type">Project Type <span className="text-danger">*</span></label>
                                        <select
                                            className="form-control"
                                            id="project_type"
                                            name="project_type"
                                            value={formData.project_type}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="">Select Project Type</option>
                                            <option value="NewProduct">New Product</option>
                                            <option value="Enhance">Enhance</option>
                                            <option value="Efficiency">Efficiency</option>
                                            <option value="Platform">Platform</option>
                                            <option value="BladeRunner">Blade Runner</option>
                                            <option value="Concord">Concord</option>
                                            <option value="Sustain">Sustain</option>
                                            <option value="NA">N/A</option>
                                            <option value="TBD">TBD</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="vitality">Vitality <span className="text-danger">*</span></label>
                                        <select className="form-control" id="vitality" name="vitality" value={formData.vitality} onChange={handleInputChange} required>
                                            <option value="">Select Vitality</option>
                                            <option value="TBD">TBD</option>
                                            <option value="YES">YES</option>
                                            <option value="NO">NO</option>
                                            <option value="N/A">N/A</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="strategic">Strategic <span className="text-danger">*</span></label>
                                        <select className="form-control" id="strategic" name="strategic" value={formData.strategic} onChange={handleInputChange} required>
                                            <option value="">Select Strategic</option>
                                            <option value="TBD">TBD</option>
                                            <option value="YES">YES</option>
                                            <option value="NO">NO</option>
                                            <option value="N/A">N/A</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="aim">Aim <span className="text-danger">*</span></label>
                                        <select className="form-control" id="aim" name="aim" value={formData.aim} onChange={handleInputChange} required>
                                            <option value="">Select Aim</option>
                                            <option value="TBD">TBD</option>
                                            <option value="YES">YES</option>
                                            <option value="NO">NO</option>
                                            <option value="N/A">N/A</option>
                                        </select>
                                    </div>
                                    {/* --- new fields start here --- */}
                                    <div className="form-group">
                                        <label htmlFor="timesheet_project_name">Timesheet Project Name</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="timesheet_project_name"
                                            name="timesheet_project_name"
                                            value={formData.timesheet_project_name}
                                            onChange={handleInputChange}
                                            placeholder="Enter Timesheet Project Name"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="technology_project">Technology Project <span className="text-danger">*</span></label>
                                        <select
                                            className="form-control"
                                            id="technology_project"
                                            name="technology_project"
                                            value={formData.technology_project}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="">Select Technology Project</option>
                                            <option value="YES">YES</option>
                                            <option value="NO">NO</option>
                                            <option value="N/A">N/A</option>
                                            <option value="TBD">TBD</option>
                                        </select>
                                    </div>
                                    {/* --- new fields end here --- */}
                                </div>
                                <div className="col-md-4">
                                    <div className="form-group">
                                        <label htmlFor="project_description">Project Description <span className="text-danger">*</span></label>
                                        <textarea className="form-control" id="project_description" name="project_description" value={formData.project_description} onChange={handleInputChange} required style={{ height: '125px', width: '300px' }}></textarea>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="start_date_est">Start Date Est. <span className="text-danger">*</span></label>
                                        <input type="date" className="form-control" id="start_date_est" name="start_date_est" value={formData.start_date_est} onChange={handleInputChange} required/>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="end_date_est">End Date Est. <span className="text-danger">*</span></label>
                                        <input type="date" className="form-control" id="end_date_est" name="end_date_est" value={formData.end_date_est} onChange={handleInputChange} required/>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="start_date_actual">Start Date Actual</label>
                                        <input type="date" className="form-control" id="start_date_actual" name="start_date_actual" value={formData.start_date_actual} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="end_date_actual">End Date Actual</label>
                                        <input type="date" className="form-control" id="end_date_actual" name="end_date_actual" value={formData.end_date_actual} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="current_status">Current Status <span className="text-danger">*</span></label>
                                        <select
                                            className="form-control"
                                            id="current_status"
                                            name="current_status"
                                            value={formData.current_status}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="">Select Current Status</option>
                                            <option value="Not Started">Not Started</option>
                                            <option value="Work In Progress">Work In Progress</option>
                                            <option value="Completed">Completed</option>
                                            <option value="On Hold">On Hold</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div className="form-group">
                                        <label htmlFor="rag_status">RAG Status <span className="text-danger">*</span></label>
                                        <select
                                            className="form-control"
                                            id="rag_status"
                                            name="rag_status"
                                            value={formData.rag_status}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="">Select RAG Status</option>
                                            <option value="N/A">N/A</option>
                                            <option value="Green">Green</option>
                                            <option value="Amber">Amber</option>
                                            <option value="Red">Red</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="comments">Comments</label>
                                        <textarea
                                            className="form-control"
                                            id="comments"
                                            name="comments"
                                            value={formData.comments}
                                            onChange={handleInputChange}
                                            style={{ height: '125px', width: '300px' }}
                                        ></textarea>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="revenue_est_growth_pa">Revenue Est. Growth PA</label>
                                        <input type="number" step="0.01" className="form-control" id="revenue_est_growth_pa" name="revenue_est_growth_pa" value={formData.revenue_est_growth_pa} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="revenue_est_current_year">Revenue Est. Current Year</label>
                                        <input type="number" step="0.01" className="form-control" id="revenue_est_current_year" name="revenue_est_current_year" value={formData.revenue_est_current_year} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="revenue_est_current_year_plus_1">Revenue Est. Current Year +1</label>
                                        <input type="number" step="0.01" className="form-control" id="revenue_est_current_year_plus_1" name="revenue_est_current_year_plus_1" value={formData.revenue_est_current_year_plus_1} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="revenue_est_current_year_plus_2">Revenue Est. Current Year +2</label>
                                        <input type="number" step="0.01" className="form-control" id="revenue_est_current_year_plus_2" name="revenue_est_current_year_plus_2" value={formData.revenue_est_current_year_plus_2} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="revenue_est_current_year_plus_3">Revenue Est. Current Year +3</label>
                                        <input type="number" step="0.01" className="form-control" id="revenue_est_current_year_plus_3" name="revenue_est_current_year_plus_3" value={formData.revenue_est_current_year_plus_3} onChange={handleInputChange} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
                                <button type="submit" className="btn btn-primary">{selectedProject ? 'Save changes' : 'Add Project'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectsModal;