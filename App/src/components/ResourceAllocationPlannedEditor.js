import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import '../styles/ResourceAllocationPlannedModal.css';

const ResourceAllocationPlannedEditor = () => {
    const navigate = useNavigate();
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
    const [allocationMode, setAllocationMode] = useState('project'); // 'resource' or 'project'

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

    // Bulk update states
    const [isBulkUpdateExpanded, setIsBulkUpdateExpanded] = useState(true);
    const [bulkProjectUpdateValues, setBulkProjectUpdateValues] = useState({
        allocation_start_date: '',
        allocation_end_date: '',
        allocation_pct: 0,
        allocation_hrs_per_week: 0
    });
    const [bulkResourceUpdateValues, setBulkResourceUpdateValues] = useState({
        allocation_start_date: '',
        allocation_end_date: '',
        allocation_pct: 0,
        allocation_hrs_per_week: 0
    });

    // Session storage key
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

    // Load state from sessionStorage on mount
    useEffect(() => {
        const savedState = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (savedState) {
            try {
                const parsedState = JSON.parse(savedState);
                setAllocations(parsedState.allocations || {});
                setChangedAllocations(parsedState.changedAllocations || {});
                setDeletions(parsedState.deletions || []);
                setAllocationMode(parsedState.allocationMode || 'resource');
                setSelectedResource(parsedState.selectedResource || null);
                setSelectedPortfolio(parsedState.selectedPortfolio || '');
                setSelectedManager(parsedState.selectedManager || '');
                setShowProjectSelector(parsedState.showProjectSelector || false);
                setSelectedProjectsForAllocation(parsedState.selectedProjectsForAllocation || []);
                setProjectFilterPortfolio(parsedState.projectFilterPortfolio || '');
                setProjectFilterProductLine(parsedState.projectFilterProductLine || '');
                setSelectedProject(parsedState.selectedProject || null);
                setSelectedProjectPortfolio(parsedState.selectedProjectPortfolio || '');
                setSelectedProductLine(parsedState.selectedProductLine || '');
                setShowResourceSelector(parsedState.showResourceSelector || false);
                setSelectedResourcesForAllocation(parsedState.selectedResourcesForAllocation || []);
                setResourceFilterPortfolio(parsedState.resourceFilterPortfolio || '');
                setResourceFilterManager(parsedState.resourceFilterManager || '');
            } catch (error) {
                console.error('Error loading saved state:', error);
            }
        }
    }, []);

    // Save state to sessionStorage whenever relevant state changes
    useEffect(() => {
        const stateToSave = {
            allocations,
            changedAllocations,
            deletions,
            allocationMode,
            selectedResource,
            selectedPortfolio,
            selectedManager,
            showProjectSelector,
            selectedProjectsForAllocation,
            projectFilterPortfolio,
            projectFilterProductLine,
            selectedProject,
            selectedProjectPortfolio,
            selectedProductLine,
            showResourceSelector,
            selectedResourcesForAllocation,
            resourceFilterPortfolio,
            resourceFilterManager
        };
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stateToSave));
    }, [allocations, changedAllocations, deletions, allocationMode, selectedResource, selectedPortfolio,
        selectedManager, showProjectSelector, selectedProjectsForAllocation, projectFilterPortfolio,
        projectFilterProductLine, selectedProject, selectedProjectPortfolio, selectedProductLine,
        showResourceSelector, selectedResourcesForAllocation, resourceFilterPortfolio, resourceFilterManager]);

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

    // Note: Don't pre-load allocations when switching modes
    // Allocations are loaded on-demand when a resource/project is selected

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
                strategic_portfolio: selectedProject.strategic_portfolio,
                product_line: selectedProject.product_line,
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

    // Bulk update handlers
    const handleBulkProjectUpdateChange = (field, value) => {
        setBulkProjectUpdateValues(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleBulkResourceUpdateChange = (field, value) => {
        setBulkResourceUpdateValues(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleConfirmBulkProjectUpdate = () => {
        selectedProjectsForAllocation.forEach(projectId => {
            setInlineProjectAllocationValues(prev => ({
                ...prev,
                [projectId]: {
                    ...prev[projectId],
                    ...bulkProjectUpdateValues
                }
            }));
        });
        // Reset bulk values
        setBulkProjectUpdateValues({
            allocation_start_date: '',
            allocation_end_date: '',
            allocation_pct: 0,
            allocation_hrs_per_week: 0
        });
    };

    const handleCancelBulkProjectUpdate = () => {
        setBulkProjectUpdateValues({
            allocation_start_date: '',
            allocation_end_date: '',
            allocation_pct: 0,
            allocation_hrs_per_week: 0
        });
    };

    const handleConfirmBulkResourceUpdate = () => {
        selectedResourcesForAllocation.forEach(resourceId => {
            setInlineResourceAllocationValues(prev => ({
                ...prev,
                [resourceId]: {
                    ...prev[resourceId],
                    ...bulkResourceUpdateValues
                }
            }));
        });
        // Reset bulk values
        setBulkResourceUpdateValues({
            allocation_start_date: '',
            allocation_end_date: '',
            allocation_pct: 0,
            allocation_hrs_per_week: 0
        });
    };

    const handleCancelBulkResourceUpdate = () => {
        setBulkResourceUpdateValues({
            allocation_start_date: '',
            allocation_end_date: '',
            allocation_pct: 0,
            allocation_hrs_per_week: 0
        });
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
            // Also remove from changedAllocations
            setChangedAllocations(prevChangedAllocations => {
                const newChangedAllocations = { ...prevChangedAllocations };
                delete newChangedAllocations[allocationId];
                return newChangedAllocations;
            });
        }
    };

    const handleCancelNewAllocations = () => {
        if (!selectedResource) return;

        // Remove all new (non-persisted) allocations for the current resource
        setAllocations(prevAllocations => {
            const newAllocations = { ...prevAllocations };
            if (newAllocations[selectedResource.resource_id]) {
                newAllocations[selectedResource.resource_id] = newAllocations[selectedResource.resource_id].filter(
                    allocation => allocation.persisted
                );
            }
            return newAllocations;
        });

        // Remove all new allocation changes from changedAllocations
        setChangedAllocations(prevChangedAllocations => {
            const newChangedAllocations = { ...prevChangedAllocations };
            Object.keys(newChangedAllocations).forEach(allocationId => {
                if (parseInt(allocationId) < 0) {
                    delete newChangedAllocations[allocationId];
                }
            });
            return newChangedAllocations;
        });
    };

    const handleClose = () => {
        // Clear session storage when explicitly closing
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        navigate('/resource-allocation-planned');
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
                // Clear session storage on successful save
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
                navigate('/resource-allocation-planned');
            })
            .catch(error => {
                console.error('Error updating resource allocation:', error);
            });
    };

    const getColor = (strategicPortfolio) => {
        return strategicPortfolios[strategicPortfolio] || '#ffffff';
    };

    const getPartialEmail = (email) => {
        if (email.length <= 15) return email;
        const atIndex = email.indexOf('@');
        if (atIndex === -1) return email; // No @ symbol, return as is
        const localPart = email.slice(0, atIndex);
        const domainPart = email.slice(atIndex);
        if (localPart.length <= 15) return email; // Local part is short enough, return full email
        return `${localPart.slice(0, 15)}...${domainPart}`;
    };

    // Calculate capacity for a specific resource by ID
    const calculateResourceCapacity = (resourceId) => {
        const resource = resources.find(r => r.resource_id === resourceId);
        if (!resource) return { total: 0, allocated: 0, available: 0 };

        const weeklyCapacity = resource.yearly_capacity ? (resource.yearly_capacity / 52) : 40;
        
        // Get all allocations for this resource across all projects
        const resourceAllocations = Object.values(allocations)
            .flat()
            .filter(a => a.resource_id === resourceId && !deletions.includes(a.allocation_id));

        const allocatedHours = resourceAllocations.reduce((sum, allocation) => {
            return sum + (parseFloat(allocation.allocation_hrs_per_week) || 0);
        }, 0);

        return {
            total: weeklyCapacity,
            allocated: allocatedHours,
            available: weeklyCapacity - allocatedHours
        };
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
        <div style={{ width: '100vw', height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', marginLeft: '-5px' }}>
            <div style={{ padding: '4px 12px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '700' }}>Resource Allocation Editor</div>

                <div className="allocation-mode-tabs" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                    <button
                        type="button"
                        className={`tab-btn ${allocationMode === 'project' ? 'active' : ''}`}
                        onClick={() => setAllocationMode('project')}
                    >
                        📊 By Project
                    </button>
                    <button
                        type="button"
                        className={`tab-btn ${allocationMode === 'resource' ? 'active' : ''}`}
                        onClick={() => setAllocationMode('resource')}
                    >
                        📋 By Resource
                    </button>
                </div>

                <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '13px', padding: '3px 10px' }}
                    onClick={() => navigate('/resource-allocation-planned')}
                >
                    Allocations Grid
                </button>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <form id="resource-allocation-form" onSubmit={addResourceAllocation} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {allocationMode === 'resource' ? (
                        <div className="by-resource-container" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* Left Panel - Resources List */}
                            <div className="resources-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div className="resource-filters" style={{ padding: '6px 8px', borderBottom: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <label style={{ fontSize: '12px', margin: 0, width: '65px' }}>Portfolio:</label>
                                        <select value={selectedPortfolio} onChange={handlePortfolioChange} style={{ fontSize: '12px', padding: '2px 4px', flex: 1 }}>
                                            <option value="">All</option>
                                            {Object.keys(strategicPortfolios).map(portfolio => (
                                                <option key={portfolio} value={portfolio}>{portfolio}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <label style={{ fontSize: '12px', margin: 0, width: '65px' }}>Manager:</label>
                                        <select value={selectedManager} onChange={handleManagerChange} style={{ fontSize: '12px', padding: '2px 4px', flex: 1 }}>
                                            <option value="">All</option>
                                            {managers.map(manager_name => (
                                                <option key={manager_name} value={manager_name}>{manager_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="resources-scroll" style={{ flex: 1, overflow: 'auto' }}>
                                    {filteredResources.map(resource => (
                                        <div
                                            key={resource.resource_id}
                                            className={`resource-item ${selectedResource?.resource_id === resource.resource_id ? 'selected' : ''}`}
                                            style={{ backgroundColor: 'white' }}
                                            onClick={() => handleResourceClick(resource)}
                                            title={`Name: ${resource.resource_name}\nEmail: ${resource.resource_email}\nRole: ${resource.resource_role}\nPortfolio: ${resource.strategic_portfolio}`}
                                        >
                                            <div className="resource-info">
                                                <div className="resource-name">{resource.resource_name} ({getPartialEmail(resource.resource_email)})</div>
                                                <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                    {resource.strategic_portfolio && (
                                                        <span
                                                            className="project-tag portfolio-tag"
                                                            style={{ backgroundColor: getColor(resource.strategic_portfolio) }}
                                                        >
                                                            {resource.strategic_portfolio}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="expand-icon" title="Project Allocation">+</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Panel - Allocations */}
                            <div className="allocations-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
                                        <div className="allocations-content" style={{ flex: 1, overflow: 'auto' }}>
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
                                                                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                        {allocation.strategic_portfolio && (
                                                                            <span
                                                                                className="project-tag portfolio-tag"
                                                                                style={{ backgroundColor: getColor(allocation.strategic_portfolio) }}
                                                                            >
                                                                                {allocation.strategic_portfolio}
                                                                            </span>
                                                                        )}
                                                                        {allocation.product_line && (
                                                                            <span className="project-tag line-tag" style={{ backgroundColor: 'transparent' }}>{allocation.product_line}</span>
                                                                        )}
                                                                        {allocation.isNew && (
                                                                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#dc2626' }}>
                                                                                New Project Allocation
                                                                            </span>
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
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '15px' }}>
                                                    <button
                                                        type="button"
                                                        className="allocate-projects-btn"
                                                        onClick={handleAllocateProjectsClick}
                                                        style={{ flex: 1 }}
                                                    >
                                                        + Allocate Projects to {selectedResource.resource_name}
                                                    </button>
                                                    {(() => {
                                                        const hasNewAllocations = allocations[selectedResource.resource_id]?.some(a => !a.persisted);
                                                        return hasNewAllocations ? (
                                                            <button
                                                                type="button"
                                                                className="cancel-allocations-btn"
                                                                onClick={handleCancelNewAllocations}
                                                            >
                                                                Cancel New Allocations
                                                            </button>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            ) : (
                                                <div className="project-selector-container">
                                                    <div className="project-selector-header">
                                                        <h6>Select Projects to Allocate ({selectedProjectsForAllocation.length} selected)</h6>
                                                        <button
                                                            type="button"
                                                            className="cancel-selector-btn"
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

                                                        {/* Bulk Update Panel for Projects */}
                                                        {selectedProjectsForAllocation.length > 1 && (
                                                            <div className="bulk-update-panel" style={{ marginBottom: '12px', border: '1px solid #e5e7eb', borderRadius: '4px', backgroundColor: 'white' }}>
                                                                <div 
                                                                    className="bulk-update-header" 
                                                                    onClick={() => setIsBulkUpdateExpanded(!isBulkUpdateExpanded)}
                                                                    style={{ 
                                                                        padding: '8px 12px', 
                                                                        cursor: 'pointer', 
                                                                        display: 'flex', 
                                                                        justifyContent: 'space-between', 
                                                                        alignItems: 'center',
                                                                        backgroundColor: '#f9fafb',
                                                                        borderBottom: isBulkUpdateExpanded ? '1px solid #e5e7eb' : 'none'
                                                                    }}
                                                                >
                                                                    <span style={{ fontSize: '11px', fontWeight: '600' }}>
                                                                        Bulk Update ({selectedProjectsForAllocation.length} projects selected)
                                                                    </span>
                                                                    <span style={{ fontSize: '14px' }}>{isBulkUpdateExpanded ? '▼' : '▶'}</span>
                                                                </div>
                                                                {isBulkUpdateExpanded && (
                                                                    <div style={{ padding: '12px' }}>
                                                                        <div className="allocation-compact-row">
                                                                            <div className="allocation-dates">
                                                                                <div className="field-group">
                                                                                    <label>Start Date</label>
                                                                                    <input
                                                                                        type="date"
                                                                                        value={bulkProjectUpdateValues.allocation_start_date}
                                                                                        onChange={(e) => handleBulkProjectUpdateChange('allocation_start_date', e.target.value)}
                                                                                    />
                                                                                </div>
                                                                                <div className="field-group">
                                                                                    <label>End Date</label>
                                                                                    <input
                                                                                        type="date"
                                                                                        value={bulkProjectUpdateValues.allocation_end_date}
                                                                                        onChange={(e) => handleBulkProjectUpdateChange('allocation_end_date', e.target.value)}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div className="allocation-sliders">
                                                                                <div className="field-group-slider">
                                                                                    <label>Allocation %: <span className="slider-value">{bulkProjectUpdateValues.allocation_pct || 0}%</span></label>
                                                                                    <input
                                                                                        type="range"
                                                                                        min="0"
                                                                                        max="100"
                                                                                        step="5"
                                                                                        value={bulkProjectUpdateValues.allocation_pct || 0}
                                                                                        onChange={(e) => handleBulkProjectUpdateChange('allocation_pct', e.target.value)}
                                                                                        className="allocation-slider"
                                                                                    />
                                                                                </div>
                                                                                <div className="field-group-slider">
                                                                                    <label>Hrs/Week: <span className="slider-value">{bulkProjectUpdateValues.allocation_hrs_per_week || 0} hrs</span></label>
                                                                                    <input
                                                                                        type="range"
                                                                                        min="0"
                                                                                        max="80"
                                                                                        step="1"
                                                                                        value={bulkProjectUpdateValues.allocation_hrs_per_week || 0}
                                                                                        onChange={(e) => handleBulkProjectUpdateChange('allocation_hrs_per_week', e.target.value)}
                                                                                        className="allocation-slider"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-secondary btn-sm"
                                                                                onClick={handleCancelBulkProjectUpdate}
                                                                                style={{ fontSize: '11px', padding: '4px 12px' }}
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-primary btn-sm"
                                                                                onClick={handleConfirmBulkProjectUpdate}
                                                                                style={{ fontSize: '11px', padding: '4px 12px' }}
                                                                            >
                                                                                Confirm Bulk Update
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

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
                                                                        backgroundColor: 'white',
                                                                        borderLeft: selectedProjectsForAllocation.includes(project.project_id) ? '4px solid #10b981' : '4px solid #e5e7eb',
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
                                                                        {!selectedProjectsForAllocation.includes(project.project_id) && (
                                                                            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                                <span style={{ fontSize: '11px' }}>
                                                                                    {project.project_id} - {project.project_name}
                                                                                </span>
                                                                                <span className="project-tag portfolio-tag" style={{ backgroundColor: getColor(project.strategic_portfolio) }}>
                                                                                    {project.strategic_portfolio}
                                                                                </span>
                                                                                {project.product_line && (
                                                                                    <span className="project-tag line-tag" style={{ backgroundColor: 'transparent' }}>{project.product_line}</span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Inline Allocation Controls */}
                                                                    {selectedProjectsForAllocation.includes(project.project_id) && (
                                                                        <div className="allocation-card" style={{ margin: '0 8px 8px 8px', border: 'none', boxShadow: 'none' }} onClick={(e) => e.stopPropagation()}>
                                                                            <div className="allocation-header">
                                                                                <div style={{ flex: 1, display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                                    <span style={{ fontSize: '11px' }}>
                                                                                        {project.project_id} - {project.project_name}
                                                                                    </span>
                                                                                    <span className="project-tag portfolio-tag" style={{ backgroundColor: getColor(project.strategic_portfolio) }}>
                                                                                        {project.strategic_portfolio}
                                                                                    </span>
                                                                                    {project.product_line && (
                                                                                        <span className="project-tag line-tag" style={{ backgroundColor: 'transparent' }}>{project.product_line}</span>
                                                                                    )}
                                                                                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#dc2626' }}>
                                                                                        New allocation
                                                                                    </span>
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
                        <div className="by-resource-container" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* Left Panel - Projects List */}
                            <div className="resources-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div className="resource-filters" style={{ padding: '6px 8px', borderBottom: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <label style={{ fontSize: '12px', margin: 0, width: '85px' }}>Portfolio:</label>
                                        <select value={selectedProjectPortfolio} onChange={handleProjectPortfolioChange} style={{ fontSize: '12px', padding: '2px 4px', flex: 1 }}>
                                            <option value="">All</option>
                                            {Object.keys(strategicPortfolios).map(portfolio => (
                                                <option key={portfolio} value={portfolio}>{portfolio}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <label style={{ fontSize: '12px', margin: 0, width: '85px' }}>Product Line:</label>
                                        <select value={selectedProductLine} onChange={handleProductLineChange} style={{ fontSize: '12px', padding: '2px 4px', flex: 1 }}>
                                            <option value="">All</option>
                                            {Object.keys(productLines).map(line => (
                                                <option key={line} value={line}>{line}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="resources-scroll" style={{ flex: 1, overflow: 'auto' }}>
                                    {filteredProjects.map(project => (
                                        <div
                                            key={project.project_id}
                                            className={`resource-item ${selectedProject?.project_id === project.project_id ? 'selected' : ''}`}
                                            style={{ backgroundColor: 'white' }}
                                            onClick={() => handleProjectClick(project)}
                                            title={`ID: ${project.project_id}\nName: ${project.project_name}\nPortfolio: ${project.strategic_portfolio}\nProduct Line: ${project.product_line}`}
                                        >
                                            <div className="resource-info">
                                                <div className="resource-name">{project.project_id} - {project.project_name}</div>
                                                <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                    {project.strategic_portfolio && (
                                                        <span
                                                            className="project-tag portfolio-tag"
                                                            style={{ backgroundColor: getColor(project.strategic_portfolio) }}
                                                        >
                                                            {project.strategic_portfolio}
                                                        </span>
                                                    )}
                                                    {project.product_line && (
                                                        <span className="project-tag line-tag" style={{ backgroundColor: 'transparent' }}>{project.product_line}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="expand-icon" title="Resource Allocation">+</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Panel - Allocations */}
                            <div className="allocations-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                                {selectedProject ? (
                                    <>
                                        {/* Allocations List */}
                                        <div className="allocations-content" style={{ flex: 1, overflow: 'auto' }}>
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
                                                                {allocation.isNew && (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedAllocationsForBulkUpdate.includes(allocation.allocation_id)}
                                                                        onChange={() => handleAllocationToggle(allocation.allocation_id)}
                                                                        style={{ marginRight: '8px', cursor: 'pointer' }}
                                                                    />
                                                                )}
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
                                                                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                        {allocation.resource_role && (
                                                                            <span className="project-tag line-tag">{allocation.resource_role}</span>
                                                                        )}
                                                                        {allocation.resource_type && (
                                                                            <span className="project-tag line-tag">{allocation.resource_type}</span>
                                                                        )}
                                                                        {(() => {
                                                                            const capacity = calculateResourceCapacity(allocation.resource_id);
                                                                            return (
                                                                                <span style={{ fontSize: '9px', color: '#667085', marginLeft: '4px' }}>
                                                                                    Capacity: {capacity.total}h | Allocated: {capacity.allocated.toFixed(1)}h | Available: {capacity.available.toFixed(1)}h
                                                                                </span>
                                                                            );
                                                                        })()}
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

                                            {/* Bulk Update Controls - Only for New Allocations */}
                                            {selectedAllocationsForBulkUpdate.length > 0 && (() => {
                                                const projectAllocations = allocations[selectedProject.project_id] || [];
                                                const hasNewAllocationsSelected = selectedAllocationsForBulkUpdate.some(allocId => {
                                                    const allocation = projectAllocations.find(a => a.allocation_id === allocId);
                                                    return allocation && allocation.isNew;
                                                });
                                                return hasNewAllocationsSelected;
                                            })() && (
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

                                                        {/* Bulk Update Panel for Resources */}
                                                        {selectedResourcesForAllocation.length > 1 && (
                                                            <div className="bulk-update-panel" style={{ marginBottom: '12px', border: '1px solid #e5e7eb', borderRadius: '4px', backgroundColor: 'white' }}>
                                                                <div 
                                                                    className="bulk-update-header" 
                                                                    onClick={() => setIsBulkUpdateExpanded(!isBulkUpdateExpanded)}
                                                                    style={{ 
                                                                        padding: '8px 12px', 
                                                                        cursor: 'pointer', 
                                                                        display: 'flex', 
                                                                        justifyContent: 'space-between', 
                                                                        alignItems: 'center',
                                                                        backgroundColor: '#f9fafb',
                                                                        borderBottom: isBulkUpdateExpanded ? '1px solid #e5e7eb' : 'none'
                                                                    }}
                                                                >
                                                                    <span style={{ fontSize: '11px', fontWeight: '600' }}>
                                                                        Bulk Update ({selectedResourcesForAllocation.length} resources selected)
                                                                    </span>
                                                                    <span style={{ fontSize: '14px' }}>{isBulkUpdateExpanded ? '▼' : '▶'}</span>
                                                                </div>
                                                                {isBulkUpdateExpanded && (
                                                                    <div style={{ padding: '12px' }}>
                                                                        <div className="allocation-compact-row">
                                                                            <div className="allocation-dates">
                                                                                <div className="field-group">
                                                                                    <label>Start Date</label>
                                                                                    <input
                                                                                        type="date"
                                                                                        value={bulkResourceUpdateValues.allocation_start_date}
                                                                                        onChange={(e) => handleBulkResourceUpdateChange('allocation_start_date', e.target.value)}
                                                                                    />
                                                                                </div>
                                                                                <div className="field-group">
                                                                                    <label>End Date</label>
                                                                                    <input
                                                                                        type="date"
                                                                                        value={bulkResourceUpdateValues.allocation_end_date}
                                                                                        onChange={(e) => handleBulkResourceUpdateChange('allocation_end_date', e.target.value)}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div className="allocation-sliders">
                                                                                <div className="field-group-slider">
                                                                                    <label>Allocation %: <span className="slider-value">{bulkResourceUpdateValues.allocation_pct || 0}%</span></label>
                                                                                    <input
                                                                                        type="range"
                                                                                        min="0"
                                                                                        max="100"
                                                                                        step="5"
                                                                                        value={bulkResourceUpdateValues.allocation_pct || 0}
                                                                                        onChange={(e) => handleBulkResourceUpdateChange('allocation_pct', e.target.value)}
                                                                                        className="allocation-slider"
                                                                                    />
                                                                                </div>
                                                                                <div className="field-group-slider">
                                                                                    <label>Hrs/Week: <span className="slider-value">{bulkResourceUpdateValues.allocation_hrs_per_week || 0} hrs</span></label>
                                                                                    <input
                                                                                        type="range"
                                                                                        min="0"
                                                                                        max="80"
                                                                                        step="1"
                                                                                        value={bulkResourceUpdateValues.allocation_hrs_per_week || 0}
                                                                                        onChange={(e) => handleBulkResourceUpdateChange('allocation_hrs_per_week', e.target.value)}
                                                                                        className="allocation-slider"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-secondary btn-sm"
                                                                                onClick={handleCancelBulkResourceUpdate}
                                                                                style={{ fontSize: '11px', padding: '4px 12px' }}
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-primary btn-sm"
                                                                                onClick={handleConfirmBulkResourceUpdate}
                                                                                style={{ fontSize: '11px', padding: '4px 12px' }}
                                                                            >
                                                                                Confirm Bulk Update
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

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
                                                                        backgroundColor: 'white',
                                                                        borderLeft: selectedResourcesForAllocation.includes(resource.resource_id) ? '4px solid #10b981' : '4px solid #e5e7eb',
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
                                                                        {!selectedResourcesForAllocation.includes(resource.resource_id) && (
                                                                            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                                <span style={{ fontSize: '11px' }}>
                                                                                    {resource.resource_name} ({getPartialEmail(resource.resource_email)})
                                                                                </span>
                                                                                <span className="project-tag portfolio-tag" style={{ backgroundColor: getColor(resource.strategic_portfolio) }}>
                                                                                    {resource.strategic_portfolio}
                                                                                </span>
                                                                                <span className="project-tag line-tag" style={{ backgroundColor: 'transparent' }}>
                                                                                    {resource.resource_role} ({resource.resource_type === 'Employee' ? 'FTE' : resource.resource_type})
                                                                                </span>
                                                                                {(() => {
                                                                                    const capacity = calculateResourceCapacity(resource.resource_id);
                                                                                    return (
                                                                                        <span style={{ fontSize: '9px', color: '#667085', marginLeft: '4px' }}>
                                                                                            Capacity: {capacity.total}h | Allocated: {capacity.allocated.toFixed(1)}h | Available: {capacity.available.toFixed(1)}h
                                                                                        </span>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Inline Allocation Controls */}
                                                                    {selectedResourcesForAllocation.includes(resource.resource_id) && (
                                                                        <div className="allocation-card" style={{ margin: '0 8px 8px 8px', border: 'none', boxShadow: 'none' }} onClick={(e) => e.stopPropagation()}>
                                                                            <div className="allocation-header">
                                                                                <div style={{ flex: 1, display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                                    <span style={{ fontSize: '11px' }}>
                                                                                        {resource.resource_name} ({getPartialEmail(resource.resource_email)})
                                                                                    </span>
                                                                                    <span className="project-tag portfolio-tag" style={{ backgroundColor: getColor(resource.strategic_portfolio) }}>
                                                                                        {resource.strategic_portfolio}
                                                                                    </span>
                                                                                    <span className="project-tag line-tag" style={{ backgroundColor: 'transparent' }}>
                                                                                        {resource.resource_role} ({resource.resource_type === 'Employee' ? 'FTE' : resource.resource_type})
                                                                                    </span>
                                                                                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#dc2626' }}>
                                                                                        New allocation
                                                                                    </span>
                                                                                    {(() => {
                                                                                        const capacity = calculateResourceCapacity(resource.resource_id);
                                                                                        return (
                                                                                            <span style={{ fontSize: '9px', color: '#667085', marginLeft: '4px' }}>
                                                                                                Capacity: {capacity.total}h | Allocated: {capacity.allocated.toFixed(1)}h | Available: {capacity.available.toFixed(1)}h
                                                                                            </span>
                                                                                        );
                                                                                    })()}
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
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSaveDisabled}
                            style={{ padding: '6px 16px', fontSize: '13px', height: '32px' }}
                        >
                            Save Allocations
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleClose}
                            style={{ padding: '6px 16px', fontSize: '13px', height: '32px' }}
                        >
                            Close
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ResourceAllocationPlannedEditor;