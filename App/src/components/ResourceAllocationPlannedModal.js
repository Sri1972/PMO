import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import '../styles/ResourceAllocationPlannedModal.css';

const ResourceAllocationModal = ({ onClose }) => {
    const [resources, setResources] = useState([]);
    const [projects, setProjects] = useState([]);
    const [allocations, setAllocations] = useState({});
    const [deletions, setDeletions] = useState([]);
    const [strategicPortfolios, setStrategicPortfolios] = useState({});
    const [productLines, setProductLines] = useState({});
    const [changedAllocations, setChangedAllocations] = useState({});
    const [isSaveDisabled, setIsSaveDisabled] = useState(true);
    const [errors, setErrors] = useState({});

    // Tab mode
    const [allocationMode, setAllocationMode] = useState('resource'); // 'resource' or 'project'

    // By Resource mode states
    const [selectedResource, setSelectedResource] = useState(null);
    const [selectedPortfolio, setSelectedPortfolio] = useState('');
    const [selectedManager, setSelectedManager] = useState('');
    const [managers, setManagers] = useState([]);
    const [showProjectSelector, setShowProjectSelector] = useState(false);
    const [selectedProjectsForAllocation, setSelectedProjectsForAllocation] = useState([]);
    const [projectFilterPortfolio, setProjectFilterPortfolio] = useState('');
    const [projectFilterProductLine, setProjectFilterProductLine] = useState('');

    // By Project mode states
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedProjectPortfolio, setSelectedProjectPortfolio] = useState('');
    const [selectedProductLine, setSelectedProductLine] = useState('');
    const [showResourceSelector, setShowResourceSelector] = useState(false);
    const [selectedResourcesForAllocation, setSelectedResourcesForAllocation] = useState([]);
    const [resourceFilterPortfolio, setResourceFilterPortfolio] = useState('');
    const [resourceFilterManager, setResourceFilterManager] = useState('');
    const [selectedAllocationsForBulkUpdate, setSelectedAllocationsForBulkUpdate] = useState([]);
    const [bulkUpdateValues, setBulkUpdateValues] = useState({
        allocation_start_date: '',
        allocation_end_date: '',
        allocation_pct: '',
        allocation_hrs_per_week: ''
    });

    // Inline allocation values for By Project mode (resource selector)
    const [inlineResourceAllocationValues, setInlineResourceAllocationValues] = useState({});

    // Inline allocation values for By Resource mode (project selector)
    const [inlineProjectAllocationValues, setInlineProjectAllocationValues] = useState({});

    const loadProjects = useCallback(() => {
        fetch(`${API_BASE_URL}/projects`)
            .then(response => response.json())
            .then(data => {
                if (!Array.isArray(data)) {
                    console.error('Unexpected response format for projects:', data);
                    setProjects([]);
                    return;
                }
                setProjects(data);
            })
            .catch(error => console.error('Error loading projects:', error));
    }, []);

    useEffect(() => {
        loadResources();
        loadProjects();
        loadStrategicPortfolios();
    }, [loadProjects]);

    // Note: We don't pre-load allocations for all projects anymore
    // Allocations are loaded on-demand when a project is selected

    useEffect(() => {
        setIsSaveDisabled(Object.keys(changedAllocations).length === 0 && deletions.length === 0 && Object.keys(errors).length > 0);
    }, [changedAllocations, deletions, errors]);

    const loadResources = () => {
        fetch(`${API_BASE_URL}/resources`)
            .then(response => response.json())
            .then(data => {
                console.log('Resources loaded from API:', data);
                if (data.length > 0) {
                    console.log('Sample resource object:', data[0]);
                }
                setResources(data);
                const distinctManagers = [...new Set(data.map(resource => resource.manager_name).filter(manager_name => manager_name))];
                setManagers(distinctManagers);
            })
            .catch(error => console.error('Error loading resources:', error));
    };

    const loadAllocationsForResource = useCallback((resourceId) => {
        console.log('Loading allocations for resource:', resourceId);
        fetch(`${API_BASE_URL}/allocations/resource/${resourceId}`)
            .then(response => response.json())
            .then(data => {
                console.log('Allocations received for resource', resourceId, ':', data);
                const filtered = Array.isArray(data)
                    ? data.filter(allocation => allocation.allocation_id !== null && allocation.allocation_id !== undefined)
                    : [];

                console.log('Filtered allocations:', filtered);

                // Enrich allocations with project data (portfolio and product line)
                const enrichedAllocations = filtered.map(allocation => {
                    const project = projects.find(p => p.project_id === allocation.project_id);
                    console.log(`Enriching allocation ${allocation.allocation_id} with project:`, project);
                    return {
                        ...allocation,
                        strategic_portfolio: project?.strategic_portfolio || allocation.strategic_portfolio,
                        product_line: project?.product_line || allocation.product_line,
                        persisted: true
                    };
                });

                console.log('Enriched allocations:', enrichedAllocations);

                // Group allocations by resource_id
                setAllocations(prevAllocations => {
                    const newAllocations = {
                        ...prevAllocations,
                        [resourceId]: enrichedAllocations
                    };
                    console.log('Updated allocations state:', newAllocations);
                    console.log('Allocations for selected resource:', newAllocations[resourceId]);
                    return newAllocations;
                });
            })
            .catch(error => console.error(`Error loading allocations for resource ${resourceId}:`, error));
    }, [projects]);

    const loadAllocationsForProject = useCallback((projectId) => {
        console.log('Loading allocations for project:', projectId);
        fetch(`${API_BASE_URL}/allocations/project?project_ids=${projectId}`)
            .then(response => response.json())
            .then(data => {
                console.log('Allocations received for project', projectId, ':', data);
                const filtered = Array.isArray(data)
                    ? data.filter(allocation => allocation.allocation_id !== null && allocation.allocation_id !== undefined)
                    : [];

                console.log('Filtered allocations:', filtered);

                // Enrich allocations with resource data
                const enrichedAllocations = filtered.map(allocation => {
                    const resource = resources.find(r => r.resource_id === allocation.resource_id);
                    console.log(`Enriching allocation ${allocation.allocation_id} with resource:`, resource);
                    return {
                        ...allocation,
                        resource_name: resource?.resource_name || allocation.resource_name,
                        resource_email: resource?.resource_email || allocation.resource_email,
                        resource_role: resource?.resource_role || allocation.resource_role,
                        resource_type: resource?.resource_type || allocation.resource_type,
                        persisted: true
                    };
                });

                console.log('Enriched allocations:', enrichedAllocations);

                setAllocations(prevAllocations => {
                    const newAllocations = {
                        ...prevAllocations,
                        [projectId]: enrichedAllocations
                    };
                    console.log('Updated allocations state:', newAllocations);
                    console.log('Allocations for selected project:', newAllocations[projectId]);
                    return newAllocations;
                });
            })
            .catch(error => console.error(`Error loading allocations for project ${projectId}:`, error));
    }, [resources]);

    const loadStrategicPortfolios = () => {
        fetch(`${API_BASE_URL}/strategic_portfolios`)
            .then(response => response.json())
            .then(data => {
                const portfolioColors = {};
                const lineColors = {};

                data.forEach((portfolio, index) => {
                    const baseColor = `hsl(${index * 60}, 70%, 80%)`;
                    portfolioColors[portfolio.strategic_portfolio] = baseColor;

                    fetch(`${API_BASE_URL}/product_lines/${portfolio.strategic_portfolio}`)
                        .then(response => response.json())
                        .then(lines => {
                            lines.forEach((line, lineIndex) => {
                                const shade = 80 - (lineIndex * 10);
                                lineColors[line.product_line] = `hsl(${index * 60}, 70%, ${shade}%)`;
                            });
                            setProductLines(prev => ({ ...prev, ...lineColors }));
                        })
                        .catch(error => console.error('Error loading product lines:', error));
                });

                setStrategicPortfolios(portfolioColors);
            })
            .catch(error => console.error('Error loading strategic portfolios:', error));
    };

    const handleResourceClick = (resource) => {
        console.log('Resource clicked:', resource);
        if (selectedResource?.resource_id === resource.resource_id) {
            console.log('Deselecting resource');
            setSelectedResource(null);
            setShowProjectSelector(false);
        } else {
            console.log('Selecting resource and loading allocations:', resource.resource_id);
            setSelectedResource(resource);
            loadAllocationsForResource(resource.resource_id);
            setShowProjectSelector(false);
        }
    };

    const handleProjectClick = (project) => {
        console.log('Project clicked:', project);
        if (selectedProject?.project_id === project.project_id) {
            console.log('Deselecting project');
            setSelectedProject(null);
            setShowResourceSelector(false);
        } else {
            console.log('Selecting project and loading allocations:', project.project_id);
            setSelectedProject(project);
            loadAllocationsForProject(project.project_id);
            setShowResourceSelector(false);
        }
    };

    const handleAllocateProjectsClick = () => {
        setShowProjectSelector(true);
        setSelectedProjectsForAllocation([]);
    };

    const handleAllocateResourcesClick = () => {
        setShowResourceSelector(true);
        setSelectedResourcesForAllocation([]);
    };

    const handleProjectToggle = (projectId) => {
        setSelectedProjectsForAllocation(prev => {
            if (prev.includes(projectId)) {
                return prev.filter(id => id !== projectId);
            } else {
                return [...prev, projectId];
            }
        });
    };

    const handleResourceToggle = (resourceId) => {
        setSelectedResourcesForAllocation(prev => {
            if (prev.includes(resourceId)) {
                return prev.filter(id => id !== resourceId);
            } else {
                return [...prev, resourceId];
            }
        });
    };

    const handleAddNewAllocations = () => {
        if (selectedProjectsForAllocation.length === 0 || !selectedResource) {
            alert('Please select at least one project to allocate');
            return;
        }

        const newAllocationsToAdd = [];
        const newChanges = {};

        selectedProjectsForAllocation.forEach(projectId => {
            const selectedProject = projects.find(p => p.project_id === projectId);
            if (!selectedProject) return;

            // Get inline allocation values for this project
            const inlineValues = inlineProjectAllocationValues[projectId] || {};

            // Generate a temporary negative ID for new allocations
            const tempId = -Date.now() - projectId; // Make each ID unique

            const newAllocation = {
                allocation_id: tempId,
                project_id: selectedProject.project_id,
                project_name: selectedProject.project_name,
                resource_id: selectedResource.resource_id,
                resource_role: selectedResource.resource_role,
                resource_type: selectedResource.resource_type,
                allocation_start_date: inlineValues.allocation_start_date || '',
                allocation_end_date: inlineValues.allocation_end_date || '',
                allocation_pct: inlineValues.allocation_pct || '',
                allocation_hrs_per_week: inlineValues.allocation_hrs_per_week || '',
                persisted: false,
                isNew: true
            };

            newAllocationsToAdd.push(newAllocation);
            newChanges[tempId] = {
                allocation_start_date: inlineValues.allocation_start_date || '',
                allocation_end_date: inlineValues.allocation_end_date || '',
                allocation_pct: inlineValues.allocation_pct || '',
                allocation_hrs_per_week: inlineValues.allocation_hrs_per_week || ''
            };
        });

        setAllocations(prevAllocations => ({
            ...prevAllocations,
            [selectedResource.resource_id]: [
                ...(prevAllocations[selectedResource.resource_id] || []),
                ...newAllocationsToAdd
            ]
        }));

        setChangedAllocations(prevChangedAllocations => ({
            ...prevChangedAllocations,
            ...newChanges
        }));

        setShowProjectSelector(false);
        setSelectedProjectsForAllocation([]);
        setInlineProjectAllocationValues({});
    };

    const handleAddNewResourceAllocations = () => {
        if (selectedResourcesForAllocation.length === 0 || !selectedProject) {
            alert('Please select at least one resource to allocate');
            return;
        }

        const newAllocationsToAdd = [];
        const newChanges = {};

        selectedResourcesForAllocation.forEach(resourceId => {
            const selectedResourceItem = resources.find(r => r.resource_id === resourceId);
            if (!selectedResourceItem) return;

            // Get inline allocation values for this resource
            const inlineValues = inlineResourceAllocationValues[resourceId] || {};

            // Generate a temporary negative ID for new allocations
            const tempId = -Date.now() - resourceId; // Make each ID unique

            const newAllocation = {
                allocation_id: tempId,
                project_id: selectedProject.project_id,
                project_name: selectedProject.project_name,
                resource_id: selectedResourceItem.resource_id,
                resource_name: selectedResourceItem.resource_name,
                resource_email: selectedResourceItem.resource_email,
                resource_role: selectedResourceItem.resource_role,
                resource_type: selectedResourceItem.resource_type,
                allocation_start_date: inlineValues.allocation_start_date || '',
                allocation_end_date: inlineValues.allocation_end_date || '',
                allocation_pct: inlineValues.allocation_pct || '',
                allocation_hrs_per_week: inlineValues.allocation_hrs_per_week || '',
                persisted: false,
                isNew: true
            };

            newAllocationsToAdd.push(newAllocation);
            newChanges[tempId] = {
                allocation_start_date: inlineValues.allocation_start_date || '',
                allocation_end_date: inlineValues.allocation_end_date || '',
                allocation_pct: inlineValues.allocation_pct || '',
                allocation_hrs_per_week: inlineValues.allocation_hrs_per_week || ''
            };
        });

        setAllocations(prevAllocations => ({
            ...prevAllocations,
            [selectedProject.project_id]: [
                ...(prevAllocations[selectedProject.project_id] || []),
                ...newAllocationsToAdd
            ]
        }));

        setChangedAllocations(prevChangedAllocations => ({
            ...prevChangedAllocations,
            ...newChanges
        }));

        setShowResourceSelector(false);
        setSelectedResourcesForAllocation([]);
        setInlineResourceAllocationValues({});
    };

    const handleAllocationToggle = (allocationId) => {
        setSelectedAllocationsForBulkUpdate(prev => {
            if (prev.includes(allocationId)) {
                return prev.filter(id => id !== allocationId);
            } else {
                return [...prev, allocationId];
            }
        });
    };

    const handleBulkUpdate = () => {
        if (selectedAllocationsForBulkUpdate.length === 0) {
            return;
        }

        const projectId = selectedProject.project_id;

        setAllocations(prevAllocations => {
            const newAllocations = { ...prevAllocations };
            const projectAllocations = newAllocations[projectId].map(allocation => {
                if (selectedAllocationsForBulkUpdate.includes(allocation.allocation_id)) {
                    return {
                        ...allocation,
                        allocation_start_date: bulkUpdateValues.allocation_start_date || allocation.allocation_start_date,
                        allocation_end_date: bulkUpdateValues.allocation_end_date || allocation.allocation_end_date,
                        allocation_pct: bulkUpdateValues.allocation_pct !== '' ? bulkUpdateValues.allocation_pct : allocation.allocation_pct,
                        allocation_hrs_per_week: bulkUpdateValues.allocation_hrs_per_week !== '' ? bulkUpdateValues.allocation_hrs_per_week : allocation.allocation_hrs_per_week
                    };
                }
                return allocation;
            });
            newAllocations[projectId] = projectAllocations;
            return newAllocations;
        });

        setChangedAllocations(prevChangedAllocations => {
            const newChangedAllocations = { ...prevChangedAllocations };
            selectedAllocationsForBulkUpdate.forEach(allocationId => {
                if (!newChangedAllocations[allocationId]) {
                    newChangedAllocations[allocationId] = {};
                }
                if (bulkUpdateValues.allocation_start_date) {
                    newChangedAllocations[allocationId].allocation_start_date = bulkUpdateValues.allocation_start_date;
                }
                if (bulkUpdateValues.allocation_end_date) {
                    newChangedAllocations[allocationId].allocation_end_date = bulkUpdateValues.allocation_end_date;
                }
                if (bulkUpdateValues.allocation_pct !== '') {
                    newChangedAllocations[allocationId].allocation_pct = bulkUpdateValues.allocation_pct;
                }
                if (bulkUpdateValues.allocation_hrs_per_week !== '') {
                    newChangedAllocations[allocationId].allocation_hrs_per_week = bulkUpdateValues.allocation_hrs_per_week;
                }
            });
            return newChangedAllocations;
        });

        // Reset bulk update state
        setSelectedAllocationsForBulkUpdate([]);
        setBulkUpdateValues({
            allocation_start_date: '',
            allocation_end_date: '',
            allocation_pct: '',
            allocation_hrs_per_week: ''
        });
    };

    const handleCancelNewAllocation = (allocationId, projectId) => {
        setAllocations(prevAllocations => ({
            ...prevAllocations,
            [projectId]: prevAllocations[projectId].filter(allocation => allocation.allocation_id !== allocationId)
        }));

        setChangedAllocations(prevChangedAllocations => {
            const newChangedAllocations = { ...prevChangedAllocations };
            delete newChangedAllocations[allocationId];
            return newChangedAllocations;
        });

        // Remove from selected allocations if it was selected
        setSelectedAllocationsForBulkUpdate(prev => prev.filter(id => id !== allocationId));
    };

    const handleCancelAllNewAllocations = () => {
        if (!selectedProject) return;

        const projectId = selectedProject.project_id;
        const projectAllocations = allocations[projectId] || [];
        const newAllocationIds = projectAllocations
            .filter(allocation => allocation.isNew)
            .map(allocation => allocation.allocation_id);

        // Remove all new allocations
        setAllocations(prevAllocations => ({
            ...prevAllocations,
            [projectId]: prevAllocations[projectId].filter(allocation => !allocation.isNew)
        }));

        // Remove from changed allocations
        setChangedAllocations(prevChangedAllocations => {
            const newChangedAllocations = { ...prevChangedAllocations };
            newAllocationIds.forEach(id => {
                delete newChangedAllocations[id];
            });
            return newChangedAllocations;
        });

        // Clear selected allocations
        setSelectedAllocationsForBulkUpdate([]);
    };

    // Handle inline allocation value changes for By Project mode (resource selector)
    const handleInlineResourceAllocationChange = (resourceId, field, value) => {
        setInlineResourceAllocationValues(prev => ({
            ...prev,
            [resourceId]: {
                ...prev[resourceId],
                [field]: value
            }
        }));
    };

    // Handle inline allocation value changes for By Resource mode (project selector)
    const handleInlineProjectAllocationChange = (projectId, field, value) => {
        setInlineProjectAllocationValues(prev => ({
            ...prev,
            [projectId]: {
                ...prev[projectId],
                [field]: value
            }
        }));
    };

    const handleUndoClick = (allocationId) => {
        setDeletions(prevDeletions => prevDeletions.filter(deletion => deletion !== allocationId));
    };

    const handleInputChange = (event, resourceId, allocationId, field) => {
        const value = event.target.value;
        setAllocations(prevAllocations => {
            const newAllocations = { ...prevAllocations };
            const resourceAllocations = newAllocations[resourceId].map(allocation => {
                if (allocation.allocation_id === allocationId) {
                    const updatedAllocation = { ...allocation, [field]: value };
                    return updatedAllocation;
                }
                return allocation;
            });
            newAllocations[resourceId] = resourceAllocations;
            return newAllocations;
        });

        setChangedAllocations(prevChangedAllocations => {
            const newChangedAllocations = { ...prevChangedAllocations };
            if (!newChangedAllocations[allocationId]) {
                newChangedAllocations[allocationId] = {};
            }
            newChangedAllocations[allocationId][field] = value;
            return newChangedAllocations;
        });
    };

    const handleDeleteClick = (allocationId, persisted) => {
        if (persisted) {
            setDeletions(prevDeletions => [...prevDeletions, allocationId]);
        } else {
            setAllocations(prevAllocations => {
                const newAllocations = { ...prevAllocations };
                Object.keys(newAllocations).forEach(resourceId => {
                    newAllocations[resourceId] = newAllocations[resourceId].filter(allocation => allocation.allocation_id !== allocationId);
                });
                return newAllocations;
            });
        }
    };

    const addResourceAllocation = (event) => {
        event.preventDefault();

        const newErrors = {};
        let hasErrors = false;

        // Validate all allocations (including new ones)
        Object.entries(allocations).forEach(([resourceId, allocationList]) => {
            allocationList.forEach(allocation => {
                // Skip deleted allocations
                if (deletions.includes(allocation.allocation_id)) {
                    return;
                }

                if (!allocation.allocation_pct && !allocation.allocation_hrs_per_week) {
                    newErrors[allocation.allocation_id] = 'Either Allocation % or Hrs./Week must be filled.';
                    hasErrors = true;
                }
                if (!allocation.allocation_start_date || !allocation.allocation_end_date) {
                    newErrors[allocation.allocation_id] = 'Start Date and End Date must be filled.';
                    hasErrors = true;
                }
            });
        });

        setErrors(newErrors);

        if (hasErrors) {
            return;
        }

        // Separate new allocations from updates
        const newAllocations = [];
        const updatePromises = [];

        Object.entries(changedAllocations).forEach(([allocationId, changes]) => {
            // Find the allocation across all resources
            let allocation = null;

            Object.entries(allocations).forEach(([resId, allocationList]) => {
                const found = allocationList.find(a => a.allocation_id === parseInt(allocationId));
                if (found) {
                    allocation = found;
                }
            });

            if (!allocation || !allocation.resource_id) {
                console.warn("Skipping update for allocationId", allocationId);
                return;
            }

            const updatedAllocation = {
                project_id: allocation.project_id,
                resource_id: allocation.resource_id,
                allocation_start_date: changes.allocation_start_date !== undefined ? changes.allocation_start_date : allocation.allocation_start_date,
                allocation_end_date: changes.allocation_end_date !== undefined ? changes.allocation_end_date : allocation.allocation_end_date,
                allocation_pct: changes.allocation_pct !== '' ? changes.allocation_pct : null,
                allocation_hrs_per_week: changes.allocation_hrs_per_week !== '' ? changes.allocation_hrs_per_week : null
            };

            // If it's a new allocation (negative ID), add to newAllocations array
            if (parseInt(allocationId) < 0) {
                newAllocations.push(updatedAllocation);
            } else {
                // Existing allocation - add allocation_id for update
                updatedAllocation.allocation_id = allocationId;

                const promise = fetch(`${API_BASE_URL}/allocate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([updatedAllocation])
                }).then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                });
                updatePromises.push(promise);
            }
        });

        // Create new allocations
        const createPromise = newAllocations.length > 0
            ? fetch(`${API_BASE_URL}/allocate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAllocations)
            }).then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            : Promise.resolve();

        const deletePromises = deletions.map(allocationId => {
            // Only delete persisted allocations (positive IDs)
            if (allocationId > 0) {
                return fetch(`${API_BASE_URL}/allocations/${allocationId}`, {
                    method: 'DELETE'
                }).then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                });
            }
            return Promise.resolve();
        });

        Promise.all([createPromise, ...updatePromises, ...deletePromises])
            .then(() => {
                onClose();
            })
            .catch(error => {
                console.error('Error updating resource allocation:', error);
            });
    };

    const getColor = (strategicPortfolio) => {
        return strategicPortfolios[strategicPortfolio] || '#ffffff';
    };

    const getPartialEmail = (email) => {
        if (email.length <= 40) return email;
        return `${email.slice(0, 40)}...`;
    };

    const handlePortfolioChange = (event) => {
        setSelectedPortfolio(event.target.value);
    };

    const handleManagerChange = (event) => {
        setSelectedManager(event.target.value);
    };

    const handleProjectPortfolioChange = (event) => {
        setSelectedProjectPortfolio(event.target.value);
    };

    const handleProductLineChange = (event) => {
        setSelectedProductLine(event.target.value);
    };

    const filteredResources = resources.filter(resource => {
        return (selectedPortfolio === '' || resource.strategic_portfolio === selectedPortfolio) &&
               (selectedManager === '' || resource.manager_name === selectedManager);
    });

    const filteredProjects = projects.filter(project => {
        return (selectedProjectPortfolio === '' || project.strategic_portfolio === selectedProjectPortfolio) &&
               (selectedProductLine === '' || project.product_line === selectedProductLine);
    });

    // Calculate capacity summary for selected resource
    const calculateCapacitySummary = () => {
        if (!selectedResource) return { total: 0, allocated: 0, available: 0 };

        console.log('Calculating capacity for resource:', selectedResource);
        console.log('Resource yearly_capacity:', selectedResource.yearly_capacity);

        // Calculate weekly capacity from yearly_capacity (yearly_capacity / 52 weeks)
        const weeklyCapacity = selectedResource.yearly_capacity ? (selectedResource.yearly_capacity / 52) : 40;
        console.log('Weekly capacity:', weeklyCapacity);

        const resourceAllocations = allocations[selectedResource.resource_id] || [];
        console.log('Resource allocations for capacity calc:', resourceAllocations);

        const allocatedHours = resourceAllocations
            .filter(a => !deletions.includes(a.allocation_id))
            .reduce((sum, allocation) => {
                const hrs = parseFloat(allocation.allocation_hrs_per_week) || 0;
                console.log('Adding allocation hours:', hrs, 'from allocation:', allocation);
                return sum + hrs;
            }, 0);

        console.log('Total allocated hours:', allocatedHours);

        return {
            total: weeklyCapacity,
            allocated: allocatedHours,
            available: weeklyCapacity - allocatedHours
        };
    };

    const capacity = calculateCapacitySummary();

    return (
        <div className="modal fade show" style={{ display: 'block', width: '100%' }} tabIndex="-1" aria-labelledby="resourceAllocationModalLabel" aria-hidden="true">
            <div className="modal-dialog modal-lg" style={{ width: '100%', maxWidth: '95%' }}>
                <div className="modal-content" style={{ width: '100%' }}>
                    <div className="modal-header">
                        <h5 className="modal-title" id="resourceAllocationModalLabel">Resource Allocation</h5>
                        <div className="allocation-mode-tabs">
                            <button
                                type="button"
                                className={`tab-btn ${allocationMode === 'resource' ? 'active' : ''}`}
                                onClick={() => setAllocationMode('resource')}
                            >
                                📋 By Resource
                            </button>
                            <button
                                type="button"
                                className={`tab-btn ${allocationMode === 'project' ? 'active' : ''}`}
                                onClick={() => setAllocationMode('project')}
                            >
                                📊 By Project
                            </button>
                        </div>
                        <button type="button" className="close" onClick={onClose} aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div className="modal-body">
                        <form id="resource-allocation-form" onSubmit={addResourceAllocation}>
                            {allocationMode === 'resource' ? (
                                <div className="by-resource-container">
                                    {/* Left Panel - Resources List */}
                                    <div className="resources-panel">
                                        <h5>Resources</h5>

                                        <div className="resource-filters">
                                            <div className="filter-group">
                                                <label>Strategic Portfolio:</label>
                                                <select value={selectedPortfolio} onChange={handlePortfolioChange}>
                                                    <option value="">All</option>
                                                    {Object.keys(strategicPortfolios).map(portfolio => (
                                                        <option key={portfolio} value={portfolio}>{portfolio}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="filter-group">
                                                <label>Manager:</label>
                                                <select value={selectedManager} onChange={handleManagerChange}>
                                                    <option value="">All</option>
                                                    {managers.map(manager_name => (
                                                        <option key={manager_name} value={manager_name}>{manager_name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="resources-scroll">
                                            {filteredResources.map(resource => (
                                                <div
                                                    key={resource.resource_id}
                                                    className={`resource-item ${selectedResource?.resource_id === resource.resource_id ? 'selected' : ''}`}
                                                    style={{ backgroundColor: '#ffffff' }}
                                                    onClick={() => handleResourceClick(resource)}
                                                    title={`Name: ${resource.resource_name}\nEmail: ${resource.resource_email}\nRole: ${resource.resource_role}`}
                                                >
                                                    <div className="resource-info">
                                                        <div className="resource-name">{resource.resource_name} ({getPartialEmail(resource.resource_email)})</div>
                                                        <div className="resource-tags">
                                                            <span className="project-tag portfolio-tag" style={{ backgroundColor: getColor(resource.strategic_portfolio) }}>
                                                                {resource.strategic_portfolio}
                                                            </span>
                                                            {resource.product_line && (
                                                                <span> / </span>
                                                            )}
                                                            {resource.product_line && (
                                                                <span className="project-tag line-tag">{resource.product_line}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="expand-icon" title="Project Allocation">+</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right Panel - Allocations */}
                                    <div className="allocations-panel">
                                        {selectedResource ? (
                                            <>
                                                {/* Capacity Summary */}
                                                <div className="capacity-summary">
                                                    <div className="capacity-item">
                                                        <div className="capacity-label">Total Weekly Capacity</div>
                                                        <div className="capacity-value">{capacity.total} hrs</div>
                                                    </div>
                                                    <div className="capacity-item">
                                                        <div className="capacity-label">Allocated Hours</div>
                                                        <div className="capacity-value allocated">{capacity.allocated.toFixed(1)} hrs</div>
                                                    </div>
                                                    <div className="capacity-item">
                                                        <div className="capacity-label">Available Hours</div>
                                                        <div className="capacity-value available">{capacity.available.toFixed(1)} hrs</div>
                                                    </div>
                                                </div>

                                                {/* Allocations List */}
                                                <div className="allocations-content">
                                                    {(() => {
                                                        const resourceAllocations = allocations[selectedResource.resource_id];
                                                        console.log('Rendering allocations for resource', selectedResource.resource_id, ':', resourceAllocations);
                                                        return resourceAllocations && resourceAllocations.length > 0 ? (
                                                            resourceAllocations.map(allocation => {
                                                            const isFaded = deletions.includes(allocation.allocation_id);
                                                            return (
                                                                <div
                                                                    key={allocation.allocation_id}
                                                                    className={`allocation-card ${allocation.isNew ? 'new' : ''}`}
                                                                    style={{
                                                                        opacity: isFaded ? 0.5 : 1
                                                                    }}
                                                                >
                                                                    <div className="allocation-header">
                                                                        <div style={{ flex: 1 }}>
                                                                            <div className="project-name">
                                                                                {allocation.project_id} - {allocation.project_name}
                                                                            </div>
                                                                            <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                                                {allocation.strategic_portfolio && (
                                                                                    <span
                                                                                        className="project-tag portfolio-tag"
                                                                                        style={{ backgroundColor: getColor(allocation.strategic_portfolio) }}
                                                                                    >
                                                                                        {allocation.strategic_portfolio}
                                                                                    </span>
                                                                                )}
                                                                                {allocation.product_line && (
                                                                                    <span className="project-tag line-tag">{allocation.product_line}</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="allocation-compact-row">
                                                                        <div className="allocation-dates">
                                                                            <div className="field-group">
                                                                                <label>Start Date</label>
                                                                                <input
                                                                                    type="date"
                                                                                    value={allocation.allocation_start_date || ''}
                                                                                    onChange={(e) => handleInputChange(e, selectedResource.resource_id, allocation.allocation_id, 'allocation_start_date')}
                                                                                />
                                                                            </div>
                                                                            <div className="field-group">
                                                                                <label>End Date</label>
                                                                                <input
                                                                                    type="date"
                                                                                    value={allocation.allocation_end_date || ''}
                                                                                    onChange={(e) => handleInputChange(e, selectedResource.resource_id, allocation.allocation_id, 'allocation_end_date')}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="allocation-sliders">
                                                                            <div className="field-group-slider">
                                                                                <label>Allocation %: <span className="slider-value">{allocation.allocation_pct || 0}%</span></label>
                                                                                <input
                                                                                    type="range"
                                                                                    min="0"
                                                                                    max="100"
                                                                                    step="5"
                                                                                    value={allocation.allocation_pct || 0}
                                                                                    onChange={(e) => handleInputChange(e, selectedResource.resource_id, allocation.allocation_id, 'allocation_pct')}
                                                                                    className="allocation-slider"
                                                                                />
                                                                            </div>
                                                                            <div className="field-group-slider">
                                                                                <label>Hrs/Week: <span className="slider-value">{allocation.allocation_hrs_per_week || 0} hrs</span></label>
                                                                                <input
                                                                                    type="range"
                                                                                    min="0"
                                                                                    max="80"
                                                                                    step="1"
                                                                                    value={allocation.allocation_hrs_per_week || 0}
                                                                                    onChange={(e) => handleInputChange(e, selectedResource.resource_id, allocation.allocation_id, 'allocation_hrs_per_week')}
                                                                                    className="allocation-slider"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            className="delete-btn"
                                                                            onClick={() => isFaded ? handleUndoClick(allocation.allocation_id) : handleDeleteClick(allocation.allocation_id, allocation.persisted)}
                                                                            title={isFaded ? 'Undo' : 'Delete'}
                                                                        >
                                                                            {isFaded ? '↻' : '🗑'}
                                                                        </button>
                                                                    </div>

                                                                    {errors[allocation.allocation_id] && (
                                                                        <div className="error-message">
                                                                            {errors[allocation.allocation_id]}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="empty-state">
                                                            <div className="empty-state-icon">📋</div>
                                                            <div className="empty-state-text">No project allocations yet</div>
                                                        </div>
                                                    );
                                                    })()}

                                                    {/* Allocate Projects Section */}
                                                    {!showProjectSelector ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-success btn-lg allocate-projects-btn"
                                                            onClick={handleAllocateProjectsClick}
                                                        >
                                                            + Allocate Projects to {selectedResource.resource_name}
                                                        </button>
                                                    ) : (
                                                        <div className="project-selector-container">
                                                            <div className="project-selector-header">
                                                                <h6>Select Projects to Allocate ({selectedProjectsForAllocation.length} selected)</h6>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary btn-lg cancel-selector-btn"
                                                                    onClick={() => setShowProjectSelector(false)}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                            <div className="project-multi-select-body">
                                                                {/* Project Filters */}
                                                                <div className="project-filters-row">
                                                                    <div className="project-filter-group">
                                                                        <label>Strategic Portfolio:</label>
                                                                        <select value={projectFilterPortfolio} onChange={(e) => setProjectFilterPortfolio(e.target.value)}>
                                                                            <option value="">All</option>
                                                                            {Object.keys(strategicPortfolios).map(portfolio => (
                                                                                <option key={portfolio} value={portfolio}>{portfolio}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <div className="project-filter-group">
                                                                        <label>Product Line:</label>
                                                                        <select value={projectFilterProductLine} onChange={(e) => setProjectFilterProductLine(e.target.value)}>
                                                                            <option value="">All</option>
                                                                            {Object.keys(productLines).map(line => (
                                                                                <option key={line} value={line}>{line}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                <div className="projects-checklist">
                                                                    {projects
                                                                        .filter(project => {
                                                                            return (projectFilterPortfolio === '' || project.strategic_portfolio === projectFilterPortfolio) &&
                                                                                   (projectFilterProductLine === '' || project.product_line === projectFilterProductLine);
                                                                        })
                                                                        .map(project => (
                                                                        <div
                                                                            key={project.project_id}
                                                                            className={`project-checkbox-item ${selectedProjectsForAllocation.includes(project.project_id) ? 'selected' : ''}`}
                                                                            style={{
                                                                                backgroundColor: getColor(project.strategic_portfolio),
                                                                                borderLeft: selectedProjectsForAllocation.includes(project.project_id) ? '4px solid #10b981' : '4px solid transparent',
                                                                                flexDirection: 'column',
                                                                                alignItems: 'stretch'
                                                                            }}
                                                                        >
                                                                            <div style={{ display: 'flex', alignItems: 'center', padding: '8px' }} onClick={() => handleProjectToggle(project.project_id)}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={selectedProjectsForAllocation.includes(project.project_id)}
                                                                                    onChange={() => handleProjectToggle(project.project_id)}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                />
                                                                                <div className="project-checkbox-content">
                                                                                    <span className="project-checkbox-name">
                                                                                        {project.project_id} - {project.project_name}
                                                                                    </span>
                                                                                    <span className="project-checkbox-tags">
                                                                                        <span className="project-tag portfolio-tag">{project.strategic_portfolio}</span>
                                                                                        {project.product_line && (
                                                                                            <span className="project-tag line-tag">{project.product_line}</span>
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                            </div>

                                                                            {/* Inline Allocation Controls */}
                                                                            {selectedProjectsForAllocation.includes(project.project_id) && (
                                                                                <div className="allocation-card" style={{
                                                                                    marginTop: '8px'
                                                                                }} onClick={(e) => e.stopPropagation()}>
                                                                                    <div className="allocation-header">
                                                                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                                                                            <div className="project-name">
                                                                                                {project.project_id} - {project.project_name}
                                                                                                <span style={{
                                                                                                    color: 'red',
                                                                                                    fontSize: '12px',
                                                                                                    marginLeft: '8px',
                                                                                                    fontWeight: 'normal'
                                                                                                }}>
                                                                                                    New allocation
                                                                                                </span>
                                                                                            </div>
                                                                                            <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                                                                <span
                                                                                                    className="project-tag portfolio-tag"
                                                                                                    style={{ backgroundColor: getColor(project.strategic_portfolio) }}
                                                                                                >
                                                                                                    {project.strategic_portfolio}
                                                                                                </span>
                                                                                                {project.product_line && (
                                                                                                    <span className="project-tag line-tag">{project.product_line}</span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="allocation-compact-row">
                                                                                        <div className="allocation-dates">
                                                                                            <div className="field-group">
                                                                                                <label>Start Date</label>
                                                                                                <input
                                                                                                    type="date"
                                                                                                    value={inlineProjectAllocationValues[project.project_id]?.allocation_start_date || ''}
                                                                                                    onChange={(e) => handleInlineProjectAllocationChange(project.project_id, 'allocation_start_date', e.target.value)}
                                                                                                />
                                                                                            </div>
                                                                                            <div className="field-group">
                                                                                                <label>End Date</label>
                                                                                                <input
                                                                                                    type="date"
                                                                                                    value={inlineProjectAllocationValues[project.project_id]?.allocation_end_date || ''}
                                                                                                    onChange={(e) => handleInlineProjectAllocationChange(project.project_id, 'allocation_end_date', e.target.value)}
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="allocation-sliders">
                                                                                            <div className="field-group-slider">
                                                                                                <label>Allocation %: <span className="slider-value">{inlineProjectAllocationValues[project.project_id]?.allocation_pct || 0}%</span></label>
                                                                                                <input
                                                                                                    type="range"
                                                                                                    min="0"
                                                                                                    max="100"
                                                                                                    step="5"
                                                                                                    value={inlineProjectAllocationValues[project.project_id]?.allocation_pct || 0}
                                                                                                    onChange={(e) => handleInlineProjectAllocationChange(project.project_id, 'allocation_pct', e.target.value)}
                                                                                                    className="allocation-slider"
                                                                                                />
                                                                                            </div>
                                                                                            <div className="field-group-slider">
                                                                                                <label>Hrs/Week: <span className="slider-value">{inlineProjectAllocationValues[project.project_id]?.allocation_hrs_per_week || 0} hrs</span></label>
                                                                                                <input
                                                                                                    type="range"
                                                                                                    min="0"
                                                                                                    max="80"
                                                                                                    step="1"
                                                                                                    value={inlineProjectAllocationValues[project.project_id]?.allocation_hrs_per_week || 0}
                                                                                                    onChange={(e) => handleInlineProjectAllocationChange(project.project_id, 'allocation_hrs_per_week', e.target.value)}
                                                                                                    className="allocation-slider"
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                        <button
                                                                                            type="button"
                                                                                            className="delete-btn"
                                                                                            onClick={() => {
                                                                                                setSelectedProjectsForAllocation(prev => prev.filter(id => id !== project.project_id));
                                                                                                setInlineProjectAllocationValues(prev => {
                                                                                                    const newValues = { ...prev };
                                                                                                    delete newValues[project.project_id];
                                                                                                    return newValues;
                                                                                                });
                                                                                            }}
                                                                                            title="Remove"
                                                                                        >
                                                                                            🗑
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="add-allocation-btn"
                                                                    onClick={handleAddNewAllocations}
                                                                    disabled={selectedProjectsForAllocation.length === 0}
                                                                >
                                                                    Add {selectedProjectsForAllocation.length} Allocation{selectedProjectsForAllocation.length !== 1 ? 's' : ''}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="empty-state">
                                                <div className="empty-state-icon">👈</div>
                                                <div className="empty-state-text">Select a resource to view allocations</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="by-resource-container">
                                    {/* Left Panel - Projects List */}
                                    <div className="resources-panel">
                                        <h5>Projects</h5>

                                        <div className="resource-filters">
                                            <div className="filter-group">
                                                <label>Strategic Portfolio:</label>
                                                <select value={selectedProjectPortfolio} onChange={handleProjectPortfolioChange}>
                                                    <option value="">All</option>
                                                    {Object.keys(strategicPortfolios).map(portfolio => (
                                                        <option key={portfolio} value={portfolio}>{portfolio}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="filter-group">
                                                <label>Product Line:</label>
                                                <select value={selectedProductLine} onChange={handleProductLineChange}>
                                                    <option value="">All</option>
                                                    {Object.keys(productLines).map(line => (
                                                        <option key={line} value={line}>{line}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="resources-scroll">
                                            {filteredProjects.map(project => (
                                                <div
                                                    key={project.project_id}
                                                    className={`resource-item ${selectedProject?.project_id === project.project_id ? 'selected' : ''}`}
                                                    style={{ backgroundColor: getColor(project.strategic_portfolio) }}
                                                    onClick={() => handleProjectClick(project)}
                                                    title={`ID: ${project.project_id}\nName: ${project.project_name}\nPortfolio: ${project.strategic_portfolio}\nProduct Line: ${project.product_line}`}
                                                >
                                                    <div className="resource-info">
                                                        <div className="resource-name">{project.project_id} - {project.project_name}</div>
                                                        <div className="resource-email">{project.strategic_portfolio} / {project.product_line}</div>
                                                    </div>
                                                    <div className="expand-icon" title="Resource Allocation">+</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right Panel - Allocations */}
                                    <div className="allocations-panel">
                                        {selectedProject ? (
                                            <>
                                                {/* Allocations List */}
                                                <div className="allocations-content">
                                                    {(() => {
                                                        const projectAllocations = allocations[selectedProject.project_id];
                                                        return projectAllocations && projectAllocations.length > 0 ? (
                                                            projectAllocations.map(allocation => {
                                                            const isFaded = deletions.includes(allocation.allocation_id);
                                                            return (
                                                                <div
                                                                    key={allocation.allocation_id}
                                                                    className={`allocation-card ${allocation.isNew ? 'new' : ''}`}
                                                                    style={{
                                                                        opacity: isFaded ? 0.5 : 1
                                                                    }}
                                                                >
                                                                    <div className="allocation-header">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedAllocationsForBulkUpdate.includes(allocation.allocation_id)}
                                                                            onChange={() => handleAllocationToggle(allocation.allocation_id)}
                                                                            style={{ marginRight: '8px', cursor: 'pointer' }}
                                                                        />
                                                                        <div style={{ flex: 1 }}>
                                                                            <div className="project-name">
                                                                                {allocation.resource_name} ({getPartialEmail(allocation.resource_email)})
                                                                                {allocation.isNew && (
                                                                                    <span style={{
                                                                                        color: 'red',
                                                                                        fontSize: '12px',
                                                                                        marginLeft: '8px',
                                                                                        fontWeight: 'normal'
                                                                                    }}>
                                                                                        New resource allocation
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                                                {allocation.resource_role && (
                                                                                    <span className="project-tag line-tag">{allocation.resource_role}</span>
                                                                                )}
                                                                                {allocation.resource_type && (
                                                                                    <span className="project-tag line-tag">{allocation.resource_type}</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="allocation-compact-row">
                                                                        <div className="allocation-dates">
                                                                            <div className="field-group">
                                                                                <label>Start Date</label>
                                                                                <input
                                                                                    type="date"
                                                                                    value={allocation.allocation_start_date || ''}
                                                                                    onChange={(e) => handleInputChange(e, selectedProject.project_id, allocation.allocation_id, 'allocation_start_date')}
                                                                                />
                                                                            </div>
                                                                            <div className="field-group">
                                                                                <label>End Date</label>
                                                                                <input
                                                                                    type="date"
                                                                                    value={allocation.allocation_end_date || ''}
                                                                                    onChange={(e) => handleInputChange(e, selectedProject.project_id, allocation.allocation_id, 'allocation_end_date')}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="allocation-sliders">
                                                                            <div className="field-group-slider">
                                                                                <label>Allocation %: <span className="slider-value">{allocation.allocation_pct || 0}%</span></label>
                                                                                <input
                                                                                    type="range"
                                                                                    min="0"
                                                                                    max="100"
                                                                                    step="5"
                                                                                    value={allocation.allocation_pct || 0}
                                                                                    onChange={(e) => handleInputChange(e, selectedProject.project_id, allocation.allocation_id, 'allocation_pct')}
                                                                                    className="allocation-slider"
                                                                                />
                                                                            </div>
                                                                            <div className="field-group-slider">
                                                                                <label>Hrs/Week: <span className="slider-value">{allocation.allocation_hrs_per_week || 0} hrs</span></label>
                                                                                <input
                                                                                    type="range"
                                                                                    min="0"
                                                                                    max="80"
                                                                                    step="1"
                                                                                    value={allocation.allocation_hrs_per_week || 0}
                                                                                    onChange={(e) => handleInputChange(e, selectedProject.project_id, allocation.allocation_id, 'allocation_hrs_per_week')}
                                                                                    className="allocation-slider"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        {allocation.isNew && !isFaded ? (
                                                                            <button
                                                                                type="button"
                                                                                className="cancel-btn"
                                                                                onClick={() => handleCancelNewAllocation(allocation.allocation_id, selectedProject.project_id)}
                                                                                title="Cancel"
                                                                                style={{
                                                                                    backgroundColor: '#dc3545',
                                                                                    color: 'white',
                                                                                    border: 'none',
                                                                                    padding: '8px 12px',
                                                                                    borderRadius: '4px',
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '14px',
                                                                                    fontWeight: 'bold',
                                                                                    whiteSpace: 'nowrap'
                                                                                }}
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                className="delete-btn"
                                                                                onClick={() => isFaded ? handleUndoClick(allocation.allocation_id) : handleDeleteClick(allocation.allocation_id, allocation.persisted)}
                                                                                title={isFaded ? 'Undo' : 'Delete'}
                                                                            >
                                                                                {isFaded ? '↻' : '🗑'}
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {errors[allocation.allocation_id] && (
                                                                        <div className="error-message">
                                                                            {errors[allocation.allocation_id]}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="empty-state">
                                                            <div className="empty-state-icon">📋</div>
                                                            <div className="empty-state-text">No resource allocations yet</div>
                                                        </div>
                                                    );
                                                    })()}

                                                    {/* Bulk Update Controls */}
                                                    {selectedAllocationsForBulkUpdate.length > 0 && (
                                                        <div className="bulk-update-container" style={{
                                                            backgroundColor: '#f8f9fa',
                                                            border: '2px solid #0d6efd',
                                                            borderRadius: '8px',
                                                            padding: '16px',
                                                            marginTop: '16px'
                                                        }}>
                                                            <h6 style={{ marginBottom: '12px', color: '#0d6efd' }}>
                                                                Bulk Update ({selectedAllocationsForBulkUpdate.length} selected)
                                                            </h6>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                                                <div className="field-group">
                                                                    <label>Start Date</label>
                                                                    <input
                                                                        type="date"
                                                                        value={bulkUpdateValues.allocation_start_date}
                                                                        onChange={(e) => setBulkUpdateValues(prev => ({ ...prev, allocation_start_date: e.target.value }))}
                                                                    />
                                                                </div>
                                                                <div className="field-group">
                                                                    <label>End Date</label>
                                                                    <input
                                                                        type="date"
                                                                        value={bulkUpdateValues.allocation_end_date}
                                                                        onChange={(e) => setBulkUpdateValues(prev => ({ ...prev, allocation_end_date: e.target.value }))}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                                                <div className="field-group-slider">
                                                                    <label>Allocation %: <span className="slider-value">{bulkUpdateValues.allocation_pct || 0}%</span></label>
                                                                    <input
                                                                        type="range"
                                                                        min="0"
                                                                        max="100"
                                                                        step="5"
                                                                        value={bulkUpdateValues.allocation_pct || 0}
                                                                        onChange={(e) => setBulkUpdateValues(prev => ({ ...prev, allocation_pct: e.target.value }))}
                                                                        className="allocation-slider"
                                                                    />
                                                                </div>
                                                                <div className="field-group-slider">
                                                                    <label>Hrs/Week: <span className="slider-value">{bulkUpdateValues.allocation_hrs_per_week || 0} hrs</span></label>
                                                                    <input
                                                                        type="range"
                                                                        min="0"
                                                                        max="80"
                                                                        step="1"
                                                                        value={bulkUpdateValues.allocation_hrs_per_week || 0}
                                                                        onChange={(e) => setBulkUpdateValues(prev => ({ ...prev, allocation_hrs_per_week: e.target.value }))}
                                                                        className="allocation-slider"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary"
                                                                    onClick={() => {
                                                                        setSelectedAllocationsForBulkUpdate([]);
                                                                        setBulkUpdateValues({
                                                                            allocation_start_date: '',
                                                                            allocation_end_date: '',
                                                                            allocation_pct: '',
                                                                            allocation_hrs_per_week: ''
                                                                        });
                                                                    }}
                                                                >
                                                                    Clear Selection
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-primary"
                                                                    onClick={handleBulkUpdate}
                                                                >
                                                                    Apply to Selected
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Allocate Resources Section */}
                                                    {!showResourceSelector ? (
                                                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-success btn-lg allocate-projects-btn"
                                                                onClick={handleAllocateResourcesClick}
                                                                style={{ flex: 1 }}
                                                            >
                                                                + Allocate Resources to {selectedProject.project_name}
                                                            </button>
                                                            {allocations[selectedProject.project_id]?.some(a => a.isNew) && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-danger btn-lg"
                                                                    onClick={handleCancelAllNewAllocations}
                                                                    style={{
                                                                        backgroundColor: '#dc3545',
                                                                        borderColor: '#dc3545',
                                                                        color: 'white'
                                                                    }}
                                                                >
                                                                    Cancel New Allocations
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="project-selector-container">
                                                            <div className="project-selector-header">
                                                                <h6>Select Resources to Allocate ({selectedResourcesForAllocation.length} selected)</h6>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary btn-lg cancel-selector-btn"
                                                                    onClick={() => setShowResourceSelector(false)}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                            <div className="project-multi-select-body">
                                                                {/* Resource Filters */}
                                                                <div className="project-filters-row">
                                                                    <div className="project-filter-group">
                                                                        <label>Strategic Portfolio:</label>
                                                                        <select value={resourceFilterPortfolio} onChange={(e) => setResourceFilterPortfolio(e.target.value)}>
                                                                            <option value="">All</option>
                                                                            {Object.keys(strategicPortfolios).map(portfolio => (
                                                                                <option key={portfolio} value={portfolio}>{portfolio}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <div className="project-filter-group">
                                                                        <label>Manager:</label>
                                                                        <select value={resourceFilterManager} onChange={(e) => setResourceFilterManager(e.target.value)}>
                                                                            <option value="">All</option>
                                                                            {managers.map(manager_name => (
                                                                                <option key={manager_name} value={manager_name}>{manager_name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                <div className="projects-checklist">
                                                                    {resources
                                                                        .filter(resource => {
                                                                            return (resourceFilterPortfolio === '' || resource.strategic_portfolio === resourceFilterPortfolio) &&
                                                                                   (resourceFilterManager === '' || resource.manager_name === resourceFilterManager);
                                                                        })
                                                                        .map(resource => (
                                                                        <div
                                                                            key={resource.resource_id}
                                                                            className={`project-checkbox-item ${selectedResourcesForAllocation.includes(resource.resource_id) ? 'selected' : ''}`}
                                                                            style={{
                                                                                backgroundColor: getColor(resource.strategic_portfolio),
                                                                                borderLeft: selectedResourcesForAllocation.includes(resource.resource_id) ? '4px solid #10b981' : '4px solid transparent',
                                                                                flexDirection: 'column',
                                                                                alignItems: 'stretch'
                                                                            }}
                                                                        >
                                                                            <div style={{ display: 'flex', alignItems: 'center', padding: '8px' }} onClick={() => handleResourceToggle(resource.resource_id)}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={selectedResourcesForAllocation.includes(resource.resource_id)}
                                                                                    onChange={() => handleResourceToggle(resource.resource_id)}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                />
                                                                                <div className="project-checkbox-content">
                                                                                    <span className="project-checkbox-name">
                                                                                        {resource.resource_name} ({getPartialEmail(resource.resource_email)})
                                                                                    </span>
                                                                                    <span className="project-checkbox-tags">
                                                                                        <span className="project-tag line-tag">{resource.resource_role}</span>
                                                                                        {resource.resource_type && (
                                                                                            <span className="project-tag line-tag">{resource.resource_type}</span>
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                            </div>

                                                                            {/* Inline Allocation Controls */}
                                                                            {selectedResourcesForAllocation.includes(resource.resource_id) && (
                                                                                <div className="allocation-card" style={{ marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                                                                                    <div className="allocation-header">
                                                                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                                                                            <div className="project-name">
                                                                                                {resource.resource_name} ({getPartialEmail(resource.resource_email)})
                                                                                                <span style={{ color: 'red', fontSize: '12px', marginLeft: '8px', fontWeight: 'normal' }}>
                                                                                                    New allocation
                                                                                                </span>
                                                                                            </div>
                                                                                            <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                                                                <span className="project-tag portfolio-tag" style={{ backgroundColor: getColor(resource.strategic_portfolio) }}>
                                                                                                    {resource.strategic_portfolio}
                                                                                                </span>
                                                                                                <span className="project-tag line-tag">{resource.resource_role}</span>
                                                                                                {resource.resource_type && (
                                                                                                    <span className="project-tag line-tag">{resource.resource_type}</span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="allocation-compact-row">
                                                                                        <div className="allocation-dates">
                                                                                            <div className="field-group">
                                                                                                <label>Start Date</label>
                                                                                                <input
                                                                                                    type="date"
                                                                                                    value={inlineResourceAllocationValues[resource.resource_id]?.allocation_start_date || ''}
                                                                                                    onChange={(e) => handleInlineResourceAllocationChange(resource.resource_id, 'allocation_start_date', e.target.value)}
                                                                                                />
                                                                                            </div>
                                                                                            <div className="field-group">
                                                                                                <label>End Date</label>
                                                                                                <input
                                                                                                    type="date"
                                                                                                    value={inlineResourceAllocationValues[resource.resource_id]?.allocation_end_date || ''}
                                                                                                    onChange={(e) => handleInlineResourceAllocationChange(resource.resource_id, 'allocation_end_date', e.target.value)}
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="allocation-sliders">
                                                                                            <div className="field-group-slider">
                                                                                                <label>Allocation %: <span className="slider-value">{inlineResourceAllocationValues[resource.resource_id]?.allocation_pct || 0}%</span></label>
                                                                                                <input
                                                                                                    type="range"
                                                                                                    min="0"
                                                                                                    max="100"
                                                                                                    step="5"
                                                                                                    value={inlineResourceAllocationValues[resource.resource_id]?.allocation_pct || 0}
                                                                                                    onChange={(e) => handleInlineResourceAllocationChange(resource.resource_id, 'allocation_pct', e.target.value)}
                                                                                                    className="allocation-slider"
                                                                                                />
                                                                                            </div>
                                                                                            <div className="field-group-slider">
                                                                                                <label>Hrs/Week: <span className="slider-value">{inlineResourceAllocationValues[resource.resource_id]?.allocation_hrs_per_week || 0} hrs</span></label>
                                                                                                <input
                                                                                                    type="range"
                                                                                                    min="0"
                                                                                                    max="80"
                                                                                                    step="1"
                                                                                                    value={inlineResourceAllocationValues[resource.resource_id]?.allocation_hrs_per_week || 0}
                                                                                                    onChange={(e) => handleInlineResourceAllocationChange(resource.resource_id, 'allocation_hrs_per_week', e.target.value)}
                                                                                                    className="allocation-slider"
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                        <button
                                                                                            type="button"
                                                                                            className="delete-btn"
                                                                                            onClick={() => {
                                                                                                setSelectedResourcesForAllocation(prev => prev.filter(id => id !== resource.resource_id));
                                                                                                setInlineResourceAllocationValues(prev => {
                                                                                                    const newValues = { ...prev };
                                                                                                    delete newValues[resource.resource_id];
                                                                                                    return newValues;
                                                                                                });
                                                                                            }}
                                                                                            title="Remove"
                                                                                        >
                                                                                            🗑
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="add-allocation-btn"
                                                                    onClick={handleAddNewResourceAllocations}
                                                                    disabled={selectedResourcesForAllocation.length === 0}
                                                                >
                                                                    Add {selectedResourcesForAllocation.length} Allocation{selectedResourcesForAllocation.length !== 1 ? 's' : ''}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="empty-state">
                                                <div className="empty-state-icon">👈</div>
                                                <div className="empty-state-text">Select a project to view allocations</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Footer Buttons */}
                            <div className="modal-footer-buttons">
                                <button type="submit" className="btn btn-primary" disabled={isSaveDisabled}>
                                    Save Allocations
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={onClose}>
                                    Close
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResourceAllocationModal;