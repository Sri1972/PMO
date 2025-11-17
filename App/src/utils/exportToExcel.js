import { ModuleRegistry } from '@ag-grid-community/core';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { CsvExportModule } from '@ag-grid-community/csv-export';

// Register the required AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule, CsvExportModule]);

export const exportToExcel = (gridApi) => {
    if (gridApi) {
        gridApi.exportDataAsCsv(); // Use CSV export for community edition
    } else {
        console.error('Grid API is not available.');
    }
};
