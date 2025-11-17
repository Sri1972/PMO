import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import '../styles/ProjectEstimation.css';

const ProjectEstimation = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [estimationRows, setEstimationRows] = useState([]);
    const [rowCounter, setRowCounter] = useState(0);
    const [expandedPortfolios, setExpandedPortfolios] = useState({});
    const [expandedProductLines, setExpandedProductLines] = useState({});
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    const milestones = {
        'Business Analysis': [],
        'Development': ['Frontend', 'API Services', 'Backend'],
        'Data Engineering': [],
        'Quality Assurance': [],
        'AI': []
    };

    const timeUnits = {
        'days': 1,
        'weeks': 5,
        'months': 22
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    // Warn user about unsaved changes when leaving the page
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges]);

    // Fetch estimations when project is selected
    useEffect(() => {
        if (selectedProject) {
            fetchEstimations(selectedProject.project_id);
        } else {
            setEstimationRows([]);
            setRowCounter(0);
            setHasChanges(false);
        }
    }, [selectedProject]);

    const fetchProjects = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/projects`);
            const data = await response.json();
            setProjects(data);
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    const fetchEstimations = async (projectId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/project_estimation?project_id=${projectId}`);
            const data = await response.json();
            
            if (data && data.length > 0) {
                // Convert fetched data to estimation rows
                const rows = data.map((est, index) => ({
                    id: index,
                    estimationId: est.estimation_id, // Store the DB ID
                    milestone: est.milestone,
                    deliverable: est.deliverable || '',
                    resources: est.resources,
                    duration: est.duration,
                    unit: est.unit,
                    personDays: est.person_days
                }));
                setEstimationRows(rows);
                setRowCounter(rows.length);
            } else {
                setEstimationRows([]);
                setRowCounter(0);
            }
            setHasChanges(false);
        } catch (error) {
            console.error('Error fetching estimations:', error);
        }
    };

    // Group projects by portfolio and product line
    const getGroupedProjects = () => {
        const grouped = {};
        projects.forEach(project => {
            const portfolio = project.strategic_portfolio || 'Uncategorized';
            const productLine = project.product_line || 'Uncategorized';

            if (!grouped[portfolio]) {
                grouped[portfolio] = {};
            }
            if (!grouped[portfolio][productLine]) {
                grouped[portfolio][productLine] = [];
            }
            grouped[portfolio][productLine].push(project);
        });
        return grouped;
    };

    const togglePortfolio = (portfolio) => {
        setExpandedPortfolios(prev => ({ ...prev, [portfolio]: !prev[portfolio] }));
    };

    const toggleProductLine = (key) => {
        setExpandedProductLines(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const selectProject = (project) => {
        if (hasChanges) {
            // Show custom confirmation modal
            const modal = document.createElement('div');
            modal.className = 'custom-confirm-modal';
            modal.innerHTML = `
                <div class="custom-confirm-overlay"></div>
                <div class="custom-confirm-box">
                    <div class="custom-confirm-icon">⚠️</div>
                    <h3>Unsaved Changes</h3>
                    <p>You have unsaved changes. Do you want to discard them?</p>
                    <div class="custom-confirm-buttons">
                        <button class="custom-confirm-cancel">Stay on Page</button>
                        <button class="custom-confirm-ok">Discard Changes</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const okBtn = modal.querySelector('.custom-confirm-ok');
            const cancelBtn = modal.querySelector('.custom-confirm-cancel');

            okBtn.onclick = () => {
                setSelectedProject(project);
                setHasChanges(false);
                document.body.removeChild(modal);
            };

            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
            };
        } else {
            setSelectedProject(project);
        }
    };

    const toggleSummary = () => {
        setIsSummaryExpanded(prev => !prev);
    };

    const addRow = () => {
        const newRow = {
            id: rowCounter,
            estimationId: null, // No DB ID for new rows
            milestone: '',
            deliverable: '',
            resources: 1,
            duration: 1,
            unit: 'days',
            personDays: 0
        };
        setEstimationRows([...estimationRows, newRow]);
        setRowCounter(rowCounter + 1);
        setHasChanges(true);
    };

    const updateRow = (id, field, value) => {
        setEstimationRows(prev => prev.map(row => {
            if (row.id === id) {
                const updated = { ...row, [field]: value };
                
                // Reset deliverable when milestone changes
                if (field === 'milestone') {
                    updated.deliverable = '';
                }
                
                // Calculate person-days
                const resources = parseFloat(updated.resources) || 0;
                const duration = parseFloat(updated.duration) || 0;
                const unitMultiplier = timeUnits[updated.unit] || 1;
                updated.personDays = resources * duration * unitMultiplier;
                
                return updated;
            }
            return row;
        }));
        setHasChanges(true);
    };

    const removeRow = (id) => {
        setEstimationRows(prev => prev.filter(row => row.id !== id));
        setHasChanges(true);
    };

    const clearAll = () => {
        setEstimationRows([]);
        setRowCounter(0);
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!selectedProject) {
            alert('Please select a project');
            return;
        }

        if (estimationRows.length === 0) {
            alert('No estimation rows to save');
            return;
        }

        // Validate all entries
        const invalidRows = estimationRows.filter(row => 
            !row.milestone || row.resources <= 0 || row.duration <= 0
        );

        if (invalidRows.length > 0) {
            alert('Please complete all required fields (Milestone, Resources > 0, Duration > 0)');
            return;
        }

        setIsSaving(true);

        try {
            // Submit each row to the API
            const promises = estimationRows.map(async (row) => {
                const payload = {
                    project_id: selectedProject.project_id,
                    milestone: row.milestone,
                    deliverable: row.deliverable || null,
                    resources: parseFloat(row.resources),
                    duration: parseFloat(row.duration),
                    unit: row.unit,
                    person_days: row.personDays
                };

                // Include estimation_id if it exists (for updates)
                if (row.estimationId) {
                    payload.estimation_id = row.estimationId;
                }

                const response = await fetch(`${API_BASE_URL}/upsert_project_estimation`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Failed to save estimation row');
                }

                return response.json();
            });

            await Promise.all(promises);

            // Show success message
            setSaveMessage('Project estimation saved successfully!');
            setTimeout(() => setSaveMessage(''), 3000);
            setHasChanges(false);

            // Reload estimations to get updated IDs
            if (selectedProject) {
                await fetchEstimations(selectedProject.project_id);
            }
        } catch (error) {
            console.error('Error saving estimation:', error);
            setSaveMessage(`Error: ${error.message}`);
            setTimeout(() => setSaveMessage(''), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        if (hasChanges) {
            // Show custom confirmation modal
            const modal = document.createElement('div');
            modal.className = 'custom-confirm-modal';
            modal.innerHTML = `
                <div class="custom-confirm-overlay"></div>
                <div class="custom-confirm-box">
                    <div class="custom-confirm-icon">⚠️</div>
                    <h3>Unsaved Changes</h3>
                    <p>You have unsaved changes. Do you want to discard them?</p>
                    <div class="custom-confirm-buttons">
                        <button class="custom-confirm-cancel">Stay on Page</button>
                        <button class="custom-confirm-ok">Discard Changes</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const okBtn = modal.querySelector('.custom-confirm-ok');
            const cancelBtn = modal.querySelector('.custom-confirm-cancel');

            okBtn.onclick = () => {
                // Reload the original data
                if (selectedProject) {
                    fetchEstimations(selectedProject.project_id);
                }
                setHasChanges(false);
                document.body.removeChild(modal);
            };

            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
            };
        }
    };

    // Calculate totals
    const calculateTotals = () => {
        let totalResources = 0;
        let totalPersonDays = 0;
        const milestoneTotals = {};

        estimationRows.forEach(row => {
            if (row.milestone) {
                totalResources += parseFloat(row.resources) || 0;
                totalPersonDays += row.personDays;

                if (!milestoneTotals[row.milestone]) {
                    milestoneTotals[row.milestone] = { resources: 0, personDays: 0 };
                }
                milestoneTotals[row.milestone].resources += parseFloat(row.resources) || 0;
                milestoneTotals[row.milestone].personDays += row.personDays;
            }
        });

        return {
            totalResources,
            totalPersonDays,
            totalPersonWeeks: totalPersonDays / 5,
            totalPersonMonths: totalPersonDays / 22,
            milestoneTotals
        };
    };

    const totals = calculateTotals();
    const groupedProjects = getGroupedProjects();

    return (
        <div className="project-estimation-container">
            {/* Left Panel - Project Tree */}
            <div className="project-tree-panel">
                <div className="panel-header">
                    <h3>Select Project</h3>
                </div>
                
                <div className="project-tree">
                    {Object.keys(groupedProjects).sort().map(portfolio => (
                        <div key={portfolio} className="portfolio-section">
                            <button
                                onClick={() => togglePortfolio(portfolio)}
                                className="tree-toggle portfolio-toggle"
                            >
                                <span className="toggle-icon">
                                    {expandedPortfolios[portfolio] ? '▼' : '▶'}
                                </span>
                                <span className="portfolio-label">{portfolio}</span>
                            </button>
                            
                            {expandedPortfolios[portfolio] && (
                                <div className="productline-list">
                                    {Object.keys(groupedProjects[portfolio]).sort().map(productLine => {
                                        const key = `${portfolio}-${productLine}`;
                                        return (
                                            <div key={key} className="productline-section">
                                                <button
                                                    onClick={() => toggleProductLine(key)}
                                                    className="tree-toggle productline-toggle"
                                                >
                                                    <span className="toggle-icon">
                                                        {expandedProductLines[key] ? '▼' : '▶'}
                                                    </span>
                                                    <span className="productline-label">{productLine}</span>
                                                </button>
                                                
                                                {expandedProductLines[key] && (
                                                    <div className="project-list">
                                                        {groupedProjects[portfolio][productLine].map(project => {
                                                            const isSelected = selectedProject && 
                                                                selectedProject.project_id === project.project_id;
                                                            return (
                                                                <button
                                                                    key={project.project_id}
                                                                    onClick={() => selectProject(project)}
                                                                    className={`project-button ${isSelected ? 'selected' : ''}`}
                                                                >
                                                                    {project.project_name}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel - Estimation */}
            <div className="estimation-panel">
                <div className="estimation-header">
                    <div>
                        <h1>Project Resource Estimation</h1>
                        {selectedProject && (
                            <p className="subtitle">
                                <strong>{selectedProject.strategic_portfolio || 'N/A'}</strong> → <strong>{selectedProject.product_line || 'N/A'}</strong> → <strong>{selectedProject.project_name}</strong>
                            </p>
                        )}
                        {!selectedProject && (
                            <p className="subtitle">Select a project from the left panel to start estimating</p>
                        )}
                    </div>
                </div>

                {selectedProject && (
                    <>
                        <div className="controls">
                            <button className="btn-primary" onClick={addRow}>+ Add Estimation Row</button>
                            <button className="btn-secondary" onClick={clearAll}>Clear All</button>
                        </div>

                        {estimationRows.length === 0 && (
                            <div className="empty-state">
                                <p>No estimations added yet. Click "+ Add Estimation Row" above to begin.</p>
                            </div>
                        )}

                        {estimationRows.length > 0 && (
                            <>
                                <div className="estimation-table-container">
                                    <table className="estimation-table">
                                        <thead>
                                            <tr>
                                                <th>Milestone</th>
                                                <th>Deliverable</th>
                                                <th>Resources</th>
                                                <th>Duration</th>
                                                <th>Time Unit</th>
                                                <th>Person-Days</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {estimationRows.map(row => (
                                                <tr key={row.id}>
                                                    <td>
                                                        <select 
                                                            className="category-select"
                                                            value={row.milestone}
                                                            onChange={(e) => updateRow(row.id, 'milestone', e.target.value)}
                                                        >
                                                            <option value="">Select Milestone</option>
                                                            {Object.keys(milestones).map(cat => (
                                                                <option key={cat} value={cat}>{cat}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={row.deliverable}
                                                            onChange={(e) => updateRow(row.id, 'deliverable', e.target.value)}
                                                            disabled={!row.milestone || milestones[row.milestone].length === 0}
                                                        >
                                                            <option value="">N/A</option>
                                                            {row.milestone && milestones[row.milestone].map(sub => (
                                                                <option key={sub} value={sub}>{sub}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input 
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            value={row.resources}
                                                            onChange={(e) => updateRow(row.id, 'resources', e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input 
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            value={row.duration}
                                                            onChange={(e) => updateRow(row.id, 'duration', e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={row.unit}
                                                            onChange={(e) => updateRow(row.id, 'unit', e.target.value)}
                                                        >
                                                            <option value="days">Days</option>
                                                            <option value="weeks">Weeks</option>
                                                            <option value="months">Months</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <span className="calculated">{row.personDays.toFixed(1)}</span>
                                                    </td>
                                                    <td>
                                                        <button 
                                                            className="remove-btn"
                                                            onClick={() => removeRow(row.id)}
                                                        >
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Action Buttons */}
                                <div className="timesheet-actions">
                                    <button 
                                        onClick={handleSave} 
                                        className="save-btn"
                                        disabled={!hasChanges || isSaving}
                                    >
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button 
                                        onClick={handleCancel} 
                                        className="cancel-btn"
                                        disabled={!hasChanges || isSaving}
                                    >
                                        Cancel
                                    </button>
                                    
                                    {saveMessage && (
                                        <div className={`save-message ${saveMessage.includes('Error') ? 'error' : 'success'}`}>
                                            {saveMessage}
                                        </div>
                                    )}
                                </div>

                                {/* Summary Section */}
                                <div className="summary-section">
                                    <div className="summary-header" onClick={toggleSummary}>
                                        <h2>Project Summary</h2>
                                        <span className="toggle-icon">
                                            {isSummaryExpanded ? '▼' : '▶'}
                                        </span>
                                    </div>
                                    {isSummaryExpanded && (
                                        <>
                                            <div className="summary-grid">
                                        <div className="summary-card">
                                            <h3>Total Resources</h3>
                                            <span className="value">{totals.totalResources.toFixed(1)}</span>
                                        </div>
                                        <div className="summary-card">
                                            <h3>Total Person-Days</h3>
                                            <span className="value">{totals.totalPersonDays.toFixed(1)}</span>
                                        </div>
                                        <div className="summary-card">
                                            <h3>Total Person-Weeks</h3>
                                            <span className="value">{totals.totalPersonWeeks.toFixed(1)}</span>
                                            <span className="unit">(5 days/week)</span>
                                        </div>
                                        <div className="summary-card">
                                            <h3>Total Person-Months</h3>
                                            <span className="value">{totals.totalPersonMonths.toFixed(1)}</span>
                                            <span className="unit">(22 days/month)</span>
                                        </div>
                                    </div>

                                    <div className="category-breakdown">
                                        <h3>Breakdown by Milestone</h3>
                                        <table className="breakdown-table">
                                            <thead>
                                                <tr>
                                                    <th>Milestone</th>
                                                    <th>Resources</th>
                                                    <th>Person-Days</th>
                                                    <th>% of Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.keys(totals.milestoneTotals)
                                                    .sort((a, b) => totals.milestoneTotals[b].personDays - totals.milestoneTotals[a].personDays)
                                                    .map(milestone => {
                                                        const data = totals.milestoneTotals[milestone];
                                                        const percentage = totals.totalPersonDays > 0 
                                                            ? ((data.personDays / totals.totalPersonDays) * 100).toFixed(1) 
                                                            : 0;
                                                        return (
                                                            <tr key={milestone}>
                                                                <td>{milestone}</td>
                                                                <td>{data.resources.toFixed(1)}</td>
                                                                <td>{data.personDays.toFixed(1)}</td>
                                                                <td>{percentage}%</td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}

                {!selectedProject && (
                    <div className="empty-state" style={{ marginTop: '4rem' }}>
                        <p>Please select a project from the left panel to begin estimation</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectEstimation;
