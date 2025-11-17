import { configureStore } from "@reduxjs/toolkit";
import projectSlice from './projectSlice'; 

const store = configureStore({
    reducer: {
        projects: projectSlice
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Ignore these actions or paths in the state
                ignoredActions: [
                    'findFleet/fetchFilterValues/fulfilled', // Example action type
                    'findFleet/applyFilters/fulfilled',
                ],
                ignoredPaths: ['findFleet.filtered.dispatchEvent'], // Example path
            },
        }),
});

export default store;
