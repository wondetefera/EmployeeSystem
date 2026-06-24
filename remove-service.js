const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
    name: 'EmployeeManagementSystem',
    script: path.join('C:', 'EmployeeSystem', 'simple-server.js')
});

// Listen for the "uninstall" event
svc.on('uninstall', function() {
    console.log('✓ Service uninstalled successfully');
});

svc.on('error', function(err) {
    console.error('✗ Service error:', err);
});

// Uninstall the service
console.log('Removing Employee Management System service...');
svc.uninstall();