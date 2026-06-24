// Attendance management JavaScript functions

function checkIn(type) {
    // Get current time for confirmation
    const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    
    if (confirm(`Are you sure you want to check in for ${type} at ${currentTime}?`)) {
        // Show loading state
        const button = document.querySelector(`button[onclick="checkIn('${type}')"]`);
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Checking in...';
        button.disabled = true;
        
        fetch('/api/attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'checkin',
                type: type
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('success', `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} check-in successful at ${data.time}!`);
                setTimeout(() => {
                    location.reload();
                }, 1500);
            } else {
                showAlert('danger', `❌ ${data.error || data.message || 'Check-in failed'}`);
                // Restore button
                button.innerHTML = originalText;
                button.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('danger', '❌ Network error. Please check your connection and try again.');
            // Restore button
            button.innerHTML = originalText;
            button.disabled = false;
        });
    }
}

function checkOut(type) {
    // Get current time for confirmation
    const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    
    if (confirm(`Are you sure you want to check out for ${type} at ${currentTime}?`)) {
        // Show loading state
        const button = document.querySelector(`button[onclick="checkOut('${type}')"]`);
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Checking out...';
        button.disabled = true;
        
        fetch('/api/attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'checkout',
                type: type
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('success', `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} check-out successful at ${data.time}!`);
                setTimeout(() => {
                    location.reload();
                }, 1500);
            } else {
                showAlert('danger', `❌ ${data.error || data.message || 'Check-out failed'}`);
                // Restore button
                button.innerHTML = originalText;
                button.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('danger', '❌ Network error. Please check your connection and try again.');
            // Restore button
            button.innerHTML = originalText;
            button.disabled = false;
        });
    }
}

function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 70px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

// Update time display
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const dateString = now.toLocaleDateString();
    
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        timeElement.textContent = `${dateString} ${timeString}`;
    }
}

// Update time every second
setInterval(updateTime, 1000);

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updateTime();
    
    // Add click handlers for attendance buttons
    const checkinButtons = document.querySelectorAll('[onclick*="checkIn"]');
    const checkoutButtons = document.querySelectorAll('[onclick*="checkOut"]');
    
    // Disable buttons based on current status
    updateButtonStates();
});

function updateButtonStates() {
    // This function can be enhanced to disable/enable buttons based on current attendance status
    // For now, it's a placeholder for future enhancements
}

// Form validation for leave requests
function validateLeaveForm() {
    const startDate = document.getElementById('start_date');
    const endDate = document.getElementById('end_date');
    const reason = document.getElementById('reason');
    
    if (!startDate.value || !endDate.value || !reason.value.trim()) {
        showAlert('danger', 'Please fill in all required fields.');
        return false;
    }
    
    if (new Date(startDate.value) > new Date(endDate.value)) {
        showAlert('danger', 'End date must be after start date.');
        return false;
    }
    
    if (new Date(startDate.value) < new Date()) {
        showAlert('danger', 'Start date cannot be in the past.');
        return false;
    }
    
    return true;
}

// Calculate working days between two dates
function calculateWorkingDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    
    while (start <= end) {
        const dayOfWeek = start.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
            workingDays++;
        }
        start.setDate(start.getDate() + 1);
    }
    
    return workingDays;
}

// Update working days display when dates change
function updateWorkingDays() {
    const startDate = document.getElementById('start_date');
    const endDate = document.getElementById('end_date');
    const workingDaysDisplay = document.getElementById('working-days');
    
    if (startDate && endDate && workingDaysDisplay && startDate.value && endDate.value) {
        const days = calculateWorkingDays(startDate.value, endDate.value);
        workingDaysDisplay.textContent = `Working days: ${days}`;
    }
}