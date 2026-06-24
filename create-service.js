const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
    name: 'EmployeeManagementSystem',
    description: 'Employee Management System - Attendance, Leave, and HR Management',
    script: path.join('C:', 'EmployeeSystem', 'simple-server.js'),
    nodeOptions: [
        '--max_old_space_size=2048'
    ],
    env: [
        {
            name: "NODE_ENV",
            value: "production"
        },
        {
            name: "PORT",
            value: "8080"
        }
    ],
    workingDirectory: 'C:\\EmployeeSystem',
    allowServiceLogon: true
});

// Listen for the "install" event, which indicates the process is available as a service.
svc.on('install', function() {
    console.log('✓ Service installed successfully');
    console.log('✓ Service will start automatically on system boot');
    svc.start();
});

svc.on('alreadyinstalled', function() {
    console.log('! Service already exists - updating configuration');
    svc.uninstall();
    setTimeout(() => {
        svc.install();
    }, 2000);
});

svc.on('start', function() {
    console.log('✓ Service started successfully');
});

svc.on('error', function(err) {
    console.error('✗ Service error:', err);
});

// Install the service
console.log('Installing Employee Management System as Windows Service...');
svc.install();