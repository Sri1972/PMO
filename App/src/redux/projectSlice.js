import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from 'axios';
import { API_BASE_URL } from '../config';

export const fetchProjectDetails = createAsyncThunk('projects/fetchProject', async (projectId) => {
    const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`);
    return response.data;
});

export const fetchProjects = createAsyncThunk('projects/fetchProjects', async () => {
    const response = await axios.get(`${API_BASE_URL}/projects`);
    return response.data;
});

export const fetchProductLines = createAsyncThunk('projects/fetchProductLines', async (strategicPortfolio) => {
    const response = await axios.get(`${API_BASE_URL}/product_lines/${strategicPortfolio}`);
    return response.data;
});

const initialState = {
    projectList : [],
    status: "idle",
    currentProject: '',
}

const projectSlice = createSlice({
    name: "projects",
    initialState,
    reducers: {
        setCurrentProject: (state, action) => {
            state.currentProject = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchProjectDetails.pending, (state) => {
                state.status = "loading";
            })
            .addCase(fetchProjectDetails.fulfilled, (state, action) => {
                state.status = "loaded";
            })
            .addCase(fetchProjectDetails.rejected, (state) => {
                state.status = "failed";
            });
    }
});
export const { setCurrentProject } = projectSlice.actions;
export default projectSlice.reducer;

