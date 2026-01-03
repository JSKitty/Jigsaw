// WebXDC API Simulator for development/testing
// This file provides a mock implementation when running outside of a WebXDC container

(function() {
    // Check if we're already in a WebXDC environment
    if (window.webxdc) {
        console.log('WebXDC environment detected');
        return;
    }

    console.log('WebXDC simulator loaded for development');

    // Mock WebXDC API
    window.webxdc = {
        // User's display name from the parent app
        selfName: 'Puzzle Player',
        
        // Self address (unique identifier)
        selfAddr: 'player@example.com',
        
        // Import files - simulates the WebXDC file picker
        importFiles: function(filter) {
            return new Promise((resolve, reject) => {
                // Create a hidden file input
                const input = document.createElement('input');
                input.type = 'file';
                input.style.display = 'none';
                
                // Set accept attribute based on filter
                const accepts = [];
                if (filter.extensions) {
                    accepts.push(filter.extensions.join(','));
                }
                if (filter.mimeTypes) {
                    accepts.push(filter.mimeTypes.join(','));
                }
                if (accepts.length > 0) {
                    input.accept = accepts.join(',');
                }
                
                // Handle multiple files
                input.multiple = filter.multiple || false;
                
                // Handle file selection
                input.onchange = function(e) {
                    const files = Array.from(e.target.files);
                    document.body.removeChild(input);
                    resolve(files);
                };
                
                // Handle cancel
                input.oncancel = function() {
                    document.body.removeChild(input);
                    resolve([]);
                };
                
                // Trigger file picker
                document.body.appendChild(input);
                input.click();
            });
        },
        
        // Send update (for multiplayer features - not used in this game)
        sendUpdate: function(update, description) {
            console.log('WebXDC sendUpdate:', description, update);
        },
        
        // Set update listener
        setUpdateListener: function(listener, serial) {
            console.log('WebXDC setUpdateListener registered');
        },
        
        // Get own address
        selfAddr: 'simulator@webxdc.local'
    };
})();
