import { combineReducers } from "redux";
import themeReducer from "./projectSlice";

// Combine reducers into the root reducer
const rootReducer = combineReducers({
    theme: themeReducer,
});

// Export the root reducer
export default rootReducer;