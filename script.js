// --- Configuration ---
const config = {
  apiBaseUrl: 'https://your-n8n-url',
  inventoryUrl: '/webhook/inventory', // Points to new workflow
  scanUrl: '/webhook/scan-upc' // Your existing scan workflow
};

// --- UI Elements ---
// Group UI element selectors for easier management
const uiElements = {
    upcInput: document.getElementById('upcInput'),
    nameInput: document.getElementById('nameInput'),
    imageInput: document.getElementById('imageInput'),
    scanStatusMessage: document.getElementById('scanStatusMessage'),
    nameSearchStatusMessage: document.getElementById('nameSearchStatusMessage'),
    imageSearchStatusMessage: document.getElementById('imageSearchStatusMessage'),
    resultsStatusMessage: document.getElementById('resultsStatusMessage'),
    searchByNameBtn: document.getElementById('searchByNameBtn'),
    searchByImageBtn: document.getElementById('searchByImageBtn'),
    refreshInventoryBtn: document.getElementById('refreshInventoryBtn'),
    inventoryTableBody: document.getElementById('inventoryTableBody'),
    themeToggle: document.getElementById('theme-checkbox'),
    toggleButtons: document.querySelectorAll('.toggle-button'),
    inputMethodGroups: document.querySelectorAll('.input-method-group'),
    // Add containers for views later
    inventoryView: document.querySelector('.container'), // Assuming this holds the main view for now
    productDetailView: null, // Will be assigned when added to HTML
    // Crop Modal Elements
    cropModal: document.getElementById('crop-modal'),
    imageToCrop: document.getElementById('image-to-crop'),
    confirmCropBtn: document.getElementById('confirm-crop-btn'),
    cancelCropBtn: document.getElementById('cancel-crop-btn'),
    closeCropModalBtn: document.getElementById('close-crop-modal')
};


// --- API Service Module ---
// Handles all communication with the backend API
const apiService = {
    _fetchWithHandling: async function(urlPath, method = 'GET', bodyData = null, mode = 'operation') {
        const fullUrl = config.apiBaseUrl + urlPath;
        uiManager.updateStatus(uiElements.resultsStatusMessage, `Performing ${mode}...`); // Generic status
        if (mode === 'inventory' || mode === 'search') {
             if (uiElements.inventoryTableBody) uiElements.inventoryTableBody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;
        }

        // Basic URL configuration check (can be expanded)
        if (!urlPath) {
             const errorMessage = `Error: API URL path for ${mode} is missing!`;
             uiManager.updateStatus(uiElements.resultsStatusMessage, errorMessage);
             console.error(errorMessage);
             if (mode === 'inventory' || mode === 'search') {
                 if (uiElements.inventoryTableBody) uiElements.inventoryTableBody.innerHTML = `<tr><td colspan="7">${errorMessage}</td></tr>`;
             }
             return null; // Indicate failure
        }

        try {
            const options = { method: method };
            if ((method === 'POST' || method === 'PUT') && bodyData) {
                if (bodyData instanceof FormData) {
                    options.body = bodyData;
                    // Don't set Content-Type for FormData
                } else {
                    options.headers = { 'Content-Type': 'application/json' };
                    options.body = JSON.stringify(bodyData);
                }
            }

            // --- Explicit Logging Before Fetch ---
            console.log(`API CALL [${mode}]:\n  URL: ${fullUrl}\n  Method: ${options.method}\n  Headers: ${JSON.stringify(options.headers || {})}`);
            // Avoid logging potentially large bodies like FormData directly, but log JSON bodies
            if (options.body && typeof options.body === 'string') { // Check if it's a stringified JSON
                 console.log(`  Body: ${options.body}`);
            } else if (options.body instanceof FormData) {
                 console.log(`  Body: FormData object (content not logged)`);
            } else {
                 console.log(`  Body: ${options.body ? typeof options.body : 'None'}`);
            }
            // --- End Explicit Logging ---

            const response = await fetch(fullUrl, options);
            console.log(`Fetch Response Status (${mode} - ${method} ${urlPath}):`, response.status);

            if (response.ok) {
                // Handle cases where no content is expected (e.g., successful DELETE or PUT)
                if (response.status === 204) {
                    console.log(`Received 204 No Content for ${mode}.`);
                    return { success: true, data: null }; // Indicate success with no data
                }
                 // Try to parse JSON, but handle potential empty responses gracefully
                const text = await response.text();
                if (!text) {
                    console.log(`Received empty response body for ${mode}.`);
                    return { success: true, data: null }; // Indicate success with no data
                }
                try {
                    const responseData = JSON.parse(text);
                    console.log(`Received data (${mode}):`, responseData);
                    return { success: true, data: responseData }; // Indicate success with data
                } catch (jsonError) {
                     console.error(`Error parsing JSON response for ${mode}:`, jsonError, "Response text:", text);
                     uiManager.updateStatus(uiElements.resultsStatusMessage, `Error: Invalid data format received from server during ${mode}.`);
                     return null; // Indicate failure
                }
            } else {
                const errorText = await response.text();
                const errorMessage = `Error during ${mode}: ${response.status} ${response.statusText}. ${errorText}`;
                uiManager.updateStatus(uiElements.resultsStatusMessage, errorMessage);
                console.error(`Error (${mode}):`, response.status, response.statusText, errorText);
                 if (mode === 'inventory' || mode === 'search') {
                     if (uiElements.inventoryTableBody) uiElements.inventoryTableBody.innerHTML = `<tr><td colspan="7">${errorMessage}</td></tr>`;
                 }
                return null; // Indicate failure
            }
        } catch (error) {
            const networkErrorMessage = `Network error during ${mode}: ${error.message}`;
            uiManager.updateStatus(uiElements.resultsStatusMessage, networkErrorMessage);
            console.error(`Network error (${mode}):`, error);
             if (mode === 'inventory' || mode === 'search') {
                 if (uiElements.inventoryTableBody) uiElements.inventoryTableBody.innerHTML = `<tr><td colspan="7">${networkErrorMessage}</td></tr>`;
             }
            return null; // Indicate failure
        }
    },

    fetchInventory: async function() {
        const result = await this._fetchWithHandling(config.inventoryUrl, 'GET', null, 'inventory');
        if (result?.success) {
            // Assuming API returns the array directly or nested under 'data'
            const productsArray = Array.isArray(result.data) ? result.data : (result.data?.data && Array.isArray(result.data.data)) ? result.data.data : [];
            uiManager.populateInventoryTable(productsArray, 'inventory');
            uiManager.updateStatus(uiElements.resultsStatusMessage, 'Inventory loaded successfully.');
        } else {
            uiManager.populateInventoryTable([], 'inventory'); // Clear table on error
        }
    },

    searchByName: async function(searchTerm) {
        uiManager.updateStatus(uiElements.nameSearchStatusMessage, `Searching for "${searchTerm}"...`);
        const result = await this._fetchWithHandling(config.searchNameUrl, 'POST', { searchTerm: searchTerm }, 'search');
        if (result?.success) {
            const productsArray = Array.isArray(result.data) ? result.data : (result.data?.data && Array.isArray(result.data.data)) ? result.data.data : [];
            uiManager.populateInventoryTable(productsArray, 'search');
            uiManager.updateStatus(uiElements.resultsStatusMessage, `Search complete. Found ${productsArray.length} item(s).`);
            uiManager.updateStatus(uiElements.nameSearchStatusMessage, ''); // Clear specific status
        } else {
            uiManager.populateInventoryTable([], 'search'); // Clear table on error
            uiManager.updateStatus(uiElements.nameSearchStatusMessage, 'Search failed.');
        }
    },

    scanUpc: async function(upc) {
        uiManager.updateStatus(uiElements.scanStatusMessage, `Sending UPC: ${upc}...`);
        // Payload only needs the UPC for this endpoint
        const payload = {
            upc: upc
        };
        // Remove the potentially confusing comment about using UPC as ID
        const result = await this._fetchWithHandling(config.scanUrl, 'POST', payload, 'scan UPC');
        if (result?.success) {
            const resultMessage = result.data?.message || 'Processing started';
            uiManager.updateStatus(uiElements.scanStatusMessage, `UPC ${upc} sent successfully! (${resultMessage}) Refreshing list...`);
            await this.fetchInventory(); // Refresh full list
            return result; // Return result on success
        } else {
            // Error message already shown by _fetchWithHandling
             uiManager.updateStatus(uiElements.scanStatusMessage, `Failed to process UPC ${upc}.`);
        }
    },

    // Placeholder for future API calls
    fetchProductDetails: async function(productId) {
        console.log(`API: Fetching details for product ${productId}`);
        // const result = await this._fetchWithHandling(`${config.productUrl}/${productId}`, 'GET', null, 'fetch product details');
        // return result?.data; // Return data on success
        // Mock data for now:
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
        return {
            id: productId,
            upc: productId === '12345' ? '123456789012' : productId,
            quantity: 5,
            base_title: `Mock Product ${productId}`,
            optimized_title: `Awesome Mock Product ${productId} - Great Deal!`,
            description: 'This is a detailed description for the mock product. It has many features and benefits.',
            market_value: 29.99,
            enrichment_status: 'Completed',
            ebay_listing_id: productId === '12345' ? '110123456789' : null,
            ebay_listing_url: productId === '12345' ? 'https://ebay.com/...' : null,
            category_id: 'cat1', // Example
            images: [ // Example image structure
                { id: 'img1', url: 'https://via.placeholder.com/150/0000FF/FFFFFF?text=Img1', order: 0 },
                { id: 'img2', url: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Img2', order: 1 },
            ],
            attributes: { // Example dynamic attributes
                'Condition': 'New',
                'Brand': 'MockBrand',
                'Color': 'Blue'
            }
        };
    },

    fetchCategories: async function() {
        console.log("API: Fetching categories");
        // const result = await this._fetchWithHandling(config.categoriesUrl, 'GET', null, 'fetch categories');
        // return result?.data; // Return data on success
        // Mock data for now:
        await new Promise(resolve => setTimeout(resolve, 100));
        return [
            { id: 'cat1', name: 'Electronics' },
            { id: 'cat2', name: 'Clothing' },
            { id: 'cat3', name: 'Home Goods' },
        ];
    },

    updateProduct: async function(productId, productData) {
        console.log(`API: Updating product ${productId}`, productData);
        // Use FormData if productData contains Blobs (cropped images) or files
        const body = (productData instanceof FormData) ? productData : JSON.stringify(productData);
        const method = 'PUT'; // Or POST if your API uses POST for updates
        const result = await this._fetchWithHandling(`${config.productUrl}/${productId}`, method, body, 'update product');
        return result?.success ?? false; // Return true on success, false otherwise
    },

     uploadImage: async function(productId, formData) {
        console.log(`API: Uploading image for product ${productId}`);
        // Ensure formData only contains the image file as expected by the backend
        const result = await this._fetchWithHandling(config.productImageUrl.replace(':id', productId), 'POST', formData, 'upload image');
        // Assuming API returns the new image object { id: '...', url: '...', order: ... }
        return result?.data; // Return new image data on success
    },

    deleteImage: async function(productId, imageId) {
        console.log(`API: Deleting image ${imageId} for product ${productId}`);
        const url = config.productImageUrl.replace(':id', productId) + `/${imageId}`; // Assuming DELETE /api/products/:id/images/:imageId
        const result = await this._fetchWithHandling(url, 'DELETE', null, 'delete image');
        return result?.success ?? false; // Return true on success
    },

    callAiWebhook: async function(productData) { // Renamed function, still accepts productData object
        // Expects productData = { id: '...', upc: '...', name: '...' }
        console.log(`API: Calling AI Webhook for product ID: ${productData.id}`); // Log updated
        if (!productData.id || (!productData.upc && !productData.name)) {
             console.error("API Error: Missing required data for AI webhook (id and upc/name).", productData); // Log updated
             uiManager.updateStatus(uiElements.resultsStatusMessage, `Error: Missing data for AI action.`); // Message updated
             return false;
        }

        // Construct payload to only send UPC
        const webhookData = {
            upc: productData.upc || null // Send null if empty
        };

        // Using aiWebhookUrl which points to /webhook/enrich-product
        const result = await this._fetchWithHandling(config.aiWebhookUrl, 'POST', webhookData, 'call AI webhook'); // Mode updated

        // Handle response
        if (result?.success) {
            console.log("AI Webhook call successful.", result.data);
            // Update UI status to show processing started
            uiManager.updateProductStatusInTable(productData.id, 'AI Processing...'); // Update table status text
            uiManager.updateStatus(uiElements.resultsStatusMessage, `AI processing initiated for product ${productData.id}.`); // Message updated
            // Note: The actual processing happens async.
        } else {
            console.error("AI Webhook call failed.");
            // Update UI status to show failure
            uiManager.updateProductStatusInTable(productData.id, 'AI Failed'); // Update table status text
            uiManager.updateStatus(uiElements.resultsStatusMessage, `Error initiating AI processing for product ${productData.id}.`); // Message updated
        }
        return result?.success ?? false;
    }

};

// --- UI Manager Module ---
// Handles DOM manipulation and UI updates
const uiManager = {

    populateInventoryTable: function(products, mode = 'inventory') {
        const tableBody = uiElements.inventoryTableBody;
        if (!tableBody) {
             console.error("UI ERROR: Inventory table body not found!");
             return;
        }
        tableBody.innerHTML = ''; // Clear existing rows
        console.log(`UI: Populating table in ${mode} mode. Products received:`, products);

        if (!Array.isArray(products)) {
            console.error("UI ERROR: Data passed to populateInventoryTable is NOT an array!", products);
            tableBody.innerHTML = '<tr><td colspan="7">Error: Invalid data format received.</td></tr>';
            return;
        }

        if (products.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7">${mode === 'search' ? 'No matching products found.' : 'No inventory items found.'}</td></tr>`;
            console.log("UI: No products to display.");
            return;
        }

        products.forEach((product, index) => {
            if (!product || typeof product !== 'object') {
                console.warn(`UI WARNING: Skipping invalid item at index ${index}:`, product);
                return; // Skip this iteration
            }

            try {
                const productId = product.id || product.upc || `temp_${index}`; // Need a reliable ID
                const row = tableBody.insertRow();
                row.id = `product-row-${productId}`; // Add ID to the row

                // Refined logic for displaying UPC/ID, handling null/empty values
                let displayId = 'N/A';
                // Check if upc is valid and not the string "null"
                if (product.upc && String(product.upc).trim() !== '' && String(product.upc).toLowerCase() !== 'null') {
                    displayId = product.upc;
                // Fallback to id if upc is not valid, checking id similarly
                } else if (product.id && String(product.id).trim() !== '' && String(product.id).toLowerCase() !== 'null') {
                    displayId = product.id;
                }
                row.insertCell().textContent = displayId;
                row.insertCell().textContent = product.quantity ?? '-';
                row.insertCell().textContent = product.optimized_title || product.base_title || product.description?.substring(0, 50) + (product.description?.length > 50 ? '...' : '') || 'N/A';
                row.insertCell().textContent = product.market_value ? `$${parseFloat(product.market_value).toFixed(2)}` : 'N/A';
                const statusCell = row.insertCell(); // Get reference to status cell
                statusCell.textContent = product.enrichment_status || 'N/A';
                statusCell.classList.add('status-cell'); // Add class for targeting
                row.insertCell().textContent = product.enrichment_status || 'N/A';

                const cellListing = row.insertCell();
                if (product.ebay_listing_url) {
                    const link = document.createElement('a');
                    link.href = product.ebay_listing_url;
                    link.textContent = product.ebay_listing_id || 'View Listing';
                    link.target = '_blank';
                    cellListing.appendChild(link);
                } else {
                    cellListing.textContent = 'Not Listed';
                }

                // Actions Cell - Updated for View Swapping
                const cellActions = row.insertCell();
                const viewBtn = document.createElement('button');
                viewBtn.textContent = 'View/Edit';
                viewBtn.dataset.productId = productId; // Store ID on the button
                viewBtn.addEventListener('click', eventHandlers.handleViewEditClick); // Use central handler
                cellActions.appendChild(viewBtn);

                // Add "Enrich" button
                const enrichBtn = document.createElement('button');
                enrichBtn.textContent = 'USE AI'; // Reverted text
                enrichBtn.dataset.productId = productId; // Store ID
                // Store other needed data directly on the button
                enrichBtn.dataset.upc = product.upc || '';
                enrichBtn.dataset.title = product.optimized_title || product.base_title || '';
                enrichBtn.classList.add('enrich-button'); // Use specific class
                enrichBtn.style.marginLeft = '5px'; // Add some spacing
                enrichBtn.addEventListener('click', eventHandlers.handleAiButtonClick); // Reverted handler name
                cellActions.appendChild(enrichBtn);

            } catch (loopError) {
                console.error(`UI ERROR: Processing product at index ${index}:`, product, loopError);
                 // Optionally insert an error row for this specific item
                 const errorRow = tableBody.insertRow();
                 const errorCell = errorRow.insertCell();
                 errorCell.colSpan = 7;
                 errorCell.textContent = `Error displaying item at index ${index}. Check console.`;
                 errorCell.style.color = 'red';
            }
        });
        console.log("UI: Finished populating table.");
    },

    setTheme: function(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            if (uiElements.themeToggle) uiElements.themeToggle.checked = true;
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
             if (uiElements.themeToggle) uiElements.themeToggle.checked = false;
        }
         console.log(`UI: Theme set to ${isDark ? 'dark' : 'light'}`);
    },

    loadTheme: function() {
        const savedTheme = localStorage.getItem('theme');
        if (!savedTheme) {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark);
             console.log(`UI: No saved theme, using system preference (${prefersDark ? 'dark' : 'light'}).`);
        } else {
            this.setTheme(savedTheme === 'dark');
             console.log(`UI: Loaded saved theme (${savedTheme}).`);
        }
    },

    handleToggleClick: function(event) {
        const clickedButton = event.target;
        const targetId = clickedButton.getAttribute('data-target');
        const targetGroup = document.getElementById(targetId);

        // Hide all groups and deactivate all buttons
        uiElements.inputMethodGroups.forEach(group => group.classList.add('hidden'));
        uiElements.toggleButtons.forEach(button => button.classList.remove('active'));

        // Show the target group and activate the clicked button
        if (targetGroup) {
            targetGroup.classList.remove('hidden');
        }
        clickedButton.classList.add('active');
         console.log(`UI: Toggled input method to ${targetId}`);

        // Optional: Focus the first input in the shown group
        const firstInput = targetGroup?.querySelector('input:not([type="file"]), textarea, select');
        if (firstInput) {
            firstInput.focus();
        }
    },

    updateStatus: function(element, message) {
        if (element) {
            element.textContent = message;
        }
         console.log(`UI Status (${element?.id || 'unknown'}): ${message}`);
    },

    // --- View Swapping Logic ---
    showView: function(viewId) {
        console.log(`UI: Attempting to show view: ${viewId}`);
        // Hide all main views first (add more as needed)
        // Use the main container for inventory view for now
        if (uiElements.inventoryView) {
             // Instead of hiding the whole container, hide specific sections within it
             const inventorySection = uiElements.inventoryView.querySelector('.inventory-section');
             const inputSection = uiElements.inventoryView.querySelector('.input-section');
             if (inventorySection) inventorySection.classList.add('hidden');
             if (inputSection) inputSection.classList.add('hidden');
             // Maybe hide the main H1 too?
             const mainH1 = uiElements.inventoryView.querySelector('h1');
             if(mainH1) mainH1.classList.add('hidden');
        }
        if (uiElements.productDetailView) uiElements.productDetailView.classList.add('hidden');

        // Show the target view
        let viewToShow = null;
        if (viewId === 'inventory') {
             // Show the sections within the main container
             const inventorySection = uiElements.inventoryView?.querySelector('.inventory-section');
             const inputSection = uiElements.inventoryView?.querySelector('.input-section');
             const mainH1 = uiElements.inventoryView?.querySelector('h1');
             if (inventorySection) inventorySection.classList.remove('hidden');
             if (inputSection) inputSection.classList.remove('hidden');
             if (mainH1) mainH1.classList.remove('hidden');
             viewToShow = uiElements.inventoryView; // Indicate success showing inventory parts
             console.log(`UI: Successfully shown view: ${viewId}`);

        } else if (viewId === 'product-detail' && uiElements.productDetailView) {
            viewToShow = uiElements.productDetailView;
            viewToShow.classList.remove('hidden');
            console.log(`UI: Successfully shown view: ${viewId}`);
        }
        // Add more views here (e.g., 'settings')

        if (!viewToShow && viewId !== 'inventory') { // Check if target view was found (and wasn't inventory)
            console.error(`UI ERROR: View with ID '${viewId}' not found or not assigned.`);
             // Fallback to inventory view if target not found
             this.showView('inventory');
        }
    },

    // --- Product Detail View Logic ---
    displayProductDetails: async function(productId) {
        console.log(`UI: Displaying details for product ${productId}`);
        this.showView('product-detail'); // Switch view first

        const container = uiElements.productDetailView;
        if (!container) {
            console.error("UI ERROR: Product detail view container not found!");
            return;
        }
        // Consider using a class for loading state for better CSS control
        container.innerHTML = '<h2><i class="fas fa-spinner fa-spin"></i> Loading Product Details...</h2>'; // Font Awesome spinner example (ensure Font Awesome is linked in HTML if using)

        // Fetch data (currently mocked in apiService)
        const productPromise = apiService.fetchProductDetails(productId);
        const categoriesPromise = apiService.fetchCategories();
        // Use Promise.allSettled for better error handling if one fails
        const [productResult, categoriesResult] = await Promise.allSettled([productPromise, categoriesPromise]);

        const product = productResult.status === 'fulfilled' ? productResult.value : null;
        const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : null;

        // --- Error Handling ---
        if (!product) {
            console.error("UI ERROR: Failed to fetch product details.", productResult.reason);
            container.innerHTML = '<h2 style="color: red;">Error loading product details. Please try again.</h2>';
            const backButton = document.createElement('button');
            backButton.textContent = 'Back to Inventory';
            backButton.type = 'button';
            backButton.onclick = () => { location.hash = '#inventory'; };
            container.appendChild(backButton);
            return;
        }
         if (!categories) {
             console.warn("UI WARNING: Failed to fetch categories.", categoriesResult.reason);
             // Continue rendering without categories, but maybe show a warning
         }


        // --- Clear Loading State & Build View ---
        container.innerHTML = ''; // Clear loading message

        const heading = document.createElement('h2');
        heading.textContent = `Edit Product: ${product.base_title || product.id}`;
        container.appendChild(heading);

        // Add "Populate with AI" button near the top
        const populateAiBtn = document.createElement('button');
        populateAiBtn.type = 'button'; // Prevent form submission
        populateAiBtn.textContent = 'Populate with AI'; // Reverted text
        populateAiBtn.dataset.productId = productId; // Store ID
        populateAiBtn.classList.add('ai-button', 'populate-ai-button'); // Add classes
        populateAiBtn.style.marginBottom = '15px'; // Add some space below
        populateAiBtn.style.display = 'block'; // Make it block level
        // Use event delegation via handleDetailViewClick
        container.appendChild(populateAiBtn);

        const form = document.createElement('form');
        form.id = 'product-edit-form';
        form.dataset.productId = productId; // Store product ID on the form for easy access
        form.addEventListener('submit', eventHandlers.handleProductSave);

        // --- State variable for this view instance ---
        // Storing order here is useful for immediate reference within displayProductDetails scope
        let currentImageOrder = product.images?.map(img => img.id) || [];

        // --- Helper Function for Creating Form Fields ---
        // (Keep this helper function definition outside displayProductDetails if used elsewhere,
        // or define it inside if only used here)
        const createFormField = (labelText, inputType, inputName, value, options = {}) => {
            const div = document.createElement('div');
            div.classList.add('form-group'); // For potential styling

            const label = document.createElement('label');
            label.htmlFor = `product-${inputName}`;
            label.textContent = labelText;
            div.appendChild(label);

            let input;
            if (inputType === 'textarea') {
                input = document.createElement('textarea');
                input.rows = options.rows || 5;
                input.textContent = value || '';
            } else if (inputType === 'select') {
                input = document.createElement('select');
                if (options.options && Array.isArray(options.options)) {
                     // Add a default empty option?
                     if (options.includeEmptyOption) {
                         const emptyOpt = document.createElement('option');
                         emptyOpt.value = '';
                         emptyOpt.textContent = options.emptyOptionText || '-- Select --';
                         input.appendChild(emptyOpt);
                     }
                    options.options.forEach(opt => {
                        const optionEl = document.createElement('option');
                        optionEl.value = opt.id;
                        optionEl.textContent = opt.name;
                        if (opt.id === value) { // Use === for comparison
                            optionEl.selected = true;
                        }
                        input.appendChild(optionEl);
                    });
                } else {
                    console.warn(`UI WARNING: No options provided for select field '${inputName}'`);
                     const defaultOpt = document.createElement('option');
                     defaultOpt.textContent = 'Error loading options';
                     defaultOpt.disabled = true;
                     input.appendChild(defaultOpt);
                }
            } else { // Default to input type text or specified type
                input = document.createElement('input');
                input.type = inputType;
                input.value = value || '';
            }

            input.id = `product-${inputName}`;
            input.name = inputName; // Crucial for FormData collection
            if (options.required) input.required = true;
            if (options.placeholder) input.placeholder = options.placeholder;
            if (inputType === 'number' && options.step) input.step = options.step; // Add step for number inputs

            div.appendChild(input);
            return div;
        };

        // --- Images Section (Moved to Top) ---
        const imgSection = document.createElement('fieldset');
        const imgLegend = document.createElement('legend');
        imgLegend.textContent = 'Images';
        imgSection.appendChild(imgLegend);
        // TODO: Implement image crop (Phase 4)
        const imgManagementArea = document.createElement('div');
        imgManagementArea.id = 'product-image-management'; // ID for targeting later

         // Display existing images (basic preview)
        const imgListContainer = document.createElement('div');
        imgListContainer.id = 'product-image-gallery'; // ID for gallery itself
        imgListContainer.style.display = 'flex';
        imgListContainer.style.flexWrap = 'wrap'; // Allow wrapping
        imgListContainer.style.gap = '10px';
        imgListContainer.style.marginTop = '10px';

        if (product.images && product.images.length > 0) {
            // Sort images by order before displaying
            product.images.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            product.images.forEach(img => {
                // Use addImagePreview helper to create the element
                this.addImagePreview(img, imgListContainer); // Pass container to append to
            });
        } else {
             // Add the "No images" message directly if needed, addImagePreview handles removal later
             const noImagesMsg = document.createElement('p');
             noImagesMsg.textContent = 'No images found for this product.';
             imgListContainer.appendChild(noImagesMsg);
        }
        imgManagementArea.appendChild(imgListContainer); // Add gallery to management area

        // Initialize SortableJS after gallery is populated
        if (imgListContainer && typeof Sortable !== 'undefined') {
            new Sortable(imgListContainer, {
                animation: 150, // ms, animation speed moving items when sorting, `0` — without animation
                ghostClass: 'sortable-ghost', // Class name for the drop placeholder
                chosenClass: 'sortable-chosen', // Class name for the chosen item
                dragClass: 'sortable-drag', // Class name for the dragging item
                onEnd: function (evt) {
                    // evt.oldIndex; // element's old index within parent
                    // evt.newIndex; // element's new index within parent
                    console.log('SortableJS: Drag ended. New order needs update.');
                    // Update the internal order based on the DOM element order
                    const updatedOrder = Array.from(imgListContainer.children).map(el => el.dataset.imageId);
                    currentImageOrder = updatedOrder; // Update the local state variable
                    console.log('SortableJS: Updated image order (variable):', currentImageOrder);

                    // *** Store the updated order in the hidden form input ***
                    const hiddenOrderInput = form.querySelector('#product-image-order');
                    if (hiddenOrderInput) {
                        hiddenOrderInput.value = JSON.stringify(currentImageOrder);
                        console.log('SortableJS: Updated hidden input value:', hiddenOrderInput.value);
                    } else {
                        console.error("SortableJS Error: Hidden input #product-image-order not found!");
                    }

                    // Optionally update the visual order numbers if displayed
                    Array.from(imgListContainer.children).forEach((el, index) => {
                         const controls = el.querySelector('.image-controls-placeholder');
                         if (controls) {
                             // Update order display (if we add one)
                             // Example: controls.querySelector('.order-display').textContent = `Order: ${index}`;
                         }
                    });
                },
            });
        } else if (typeof Sortable === 'undefined') {
            console.warn("UI WARNING: SortableJS library not found. Drag-and-drop reordering disabled.");
        }

        // --- Add File Input for Upload ---
        const uploadContainer = document.createElement('div');
        uploadContainer.style.marginTop = '15px';

        const uploadLabel = document.createElement('label');
        uploadLabel.htmlFor = 'product-image-upload';
        uploadLabel.textContent = 'Upload New Images:';
        uploadLabel.style.display = 'block';
        uploadLabel.style.marginBottom = '5px';

        const uploadInput = document.createElement('input');
        uploadInput.type = 'file';
        uploadInput.id = 'product-image-upload';
        uploadInput.name = 'productImages'; // Name for potential direct form submission (though we handle via JS)
        uploadInput.multiple = true;
        uploadInput.accept = 'image/*'; // Accept only image files
        // Add event listener via delegation in main setup

        uploadContainer.appendChild(uploadLabel);
        uploadContainer.appendChild(uploadInput);
        imgManagementArea.appendChild(uploadContainer);

        imgSection.appendChild(imgManagementArea);
        form.appendChild(imgSection); // Add Images section first

        // --- Standard Fields ---
        form.appendChild(createFormField('Title:', 'text', 'title', product.optimized_title || product.base_title, { required: true }));
        form.appendChild(createFormField('Description:', 'textarea', 'description', product.description));
        form.appendChild(createFormField('UPC:', 'text', 'upc', product.upc));
        form.appendChild(createFormField('Quantity:', 'number', 'quantity', product.quantity));
        form.appendChild(createFormField('Market Value:', 'number', 'market_value', product.market_value, { placeholder: 'e.g., 29.99', step: '0.01' }));

        // --- Category Selector ---
        if (categories && categories.length > 0) {
            form.appendChild(createFormField('Category:', 'select', 'category_id', product.category_id, { options: categories, includeEmptyOption: true, emptyOptionText: '-- Select Category --' }));
        } else {
            const catWarning = document.createElement('p');
            catWarning.textContent = 'Could not load categories. Please try saving and reloading.';
            catWarning.style.color = 'orange';
            form.appendChild(catWarning);
        }

        // --- Dynamic Attributes Section (Placeholder) ---
        const attrSection = document.createElement('fieldset');
        const attrLegend = document.createElement('legend');
        attrLegend.textContent = 'Attributes';
        attrSection.appendChild(attrLegend);
        // TODO: Dynamically generate attribute fields based on selected category and product.attributes
        const attrPlaceholder = document.createElement('div'); // Use div for better structure
        attrPlaceholder.id = 'product-attributes-dynamic'; // ID for targeting
        attrPlaceholder.innerHTML = '<p><i>(Attribute fields will appear here based on the selected category)</i></p>';
        attrSection.appendChild(attrPlaceholder);
        // Example display of existing attributes (can be refined):
        if (product.attributes && Object.keys(product.attributes).length > 0) {
             const attrList = document.createElement('ul');
             attrList.style.listStyle = 'none';
             attrList.style.paddingLeft = '0';
             for (const [key, value] of Object.entries(product.attributes)) {
                 const li = document.createElement('li');
                 li.innerHTML = `<strong>${key}:</strong> ${value}`; // Basic display
                 attrList.appendChild(li);
             }
             attrSection.appendChild(attrList);
        }
        form.appendChild(attrSection); // Attributes section remains after standard fields

        // --- Hidden input for image order ---
        const hiddenOrderInput = document.createElement('input');
        hiddenOrderInput.type = 'hidden';
        hiddenOrderInput.id = 'product-image-order';
        hiddenOrderInput.name = 'imageOrder'; // Name used by FormData
        hiddenOrderInput.value = JSON.stringify(currentImageOrder); // Set initial order
        form.appendChild(hiddenOrderInput);

        // --- Action Buttons ---
        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('form-actions'); // For styling
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.paddingTop = '20px';
        buttonContainer.style.borderTop = '1px solid var(--border-color)';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'submit';
        saveBtn.textContent = 'Save Changes';
        // ID already stored on form dataset

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.marginLeft = '10px'; // Add some space
        cancelBtn.addEventListener('click', eventHandlers.handleProductCancel);

        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(cancelBtn);
        form.appendChild(buttonContainer);

        // --- Append Form to Container ---
        container.appendChild(form);
    }, // End displayProductDetails

    // --- Add Image Preview Helper ---
    // Modified to accept the container to append to, used by both initial load and upload handler
    addImagePreview: function(imageData, galleryContainer) {
        if (!galleryContainer) {
            console.error("UI Error: Gallery container not provided to addImagePreview.");
            return;
        }
        console.log("UI: Adding image preview for:", imageData);

        // Reuse the same structure as in displayProductDetails
        const imgContainer = document.createElement('div');
        imgContainer.classList.add('image-preview-container');
        imgContainer.dataset.imageId = imageData.id; // Use ID from API response
        imgContainer.style.border = '1px solid var(--border-color-table)';
        imgContainer.style.padding = '5px';
        imgContainer.style.position = 'relative';

        const imgEl = document.createElement('img');
        imgEl.src = imageData.url; // Use URL from API response
        imgEl.alt = `Product Image`; // Add order/alt text later if needed
        imgEl.style.width = '100px';
        imgEl.style.height = '100px';
        imgEl.style.objectFit = 'cover';
        imgEl.style.display = 'block';
        imgContainer.appendChild(imgEl);

        // Add controls placeholder
        const controlsPlaceholder = document.createElement('div');
        controlsPlaceholder.classList.add('image-controls-placeholder');
        controlsPlaceholder.style.fontSize = '0.8em';
        controlsPlaceholder.style.textAlign = 'center';
        controlsPlaceholder.style.marginTop = '3px';
        // Determine the order based on current number of images in the specific container
        const currentOrder = galleryContainer.querySelectorAll('.image-preview-container').length;
        // Use imageData.order if provided by API, otherwise use calculated order
        const displayOrder = imageData.order ?? currentOrder;
        controlsPlaceholder.innerHTML = `Order: ${displayOrder} <button type="button" class="crop-btn" data-image-id="${imageData.id}" style="font-size:0.8em; padding: 1px 3px;">Crop</button> <button type="button" class="delete-btn" data-image-id="${imageData.id}" style="font-size:0.8em; padding: 1px 3px; color:red;">X</button>`;
        imgContainer.appendChild(controlsPlaceholder);

        galleryContainer.appendChild(imgContainer);

        // Remove the "No images found" message if it exists within this specific gallery
        const noImagesMsg = galleryContainer.querySelector('p');
        if (noImagesMsg && noImagesMsg.textContent.includes("No images found")) {
            noImagesMsg.remove();
        }
         console.log("UI: Image preview added.");
    }, // End addImagePreview

    // --- Remove Image Preview Helper ---
    removeImagePreview: function(imageId) {
        console.log(`UI: Removing image preview for ID: ${imageId}`);
        const gallery = document.getElementById('product-image-gallery');
        if (!gallery) {
            console.error("UI Error: Image gallery container not found.");
            return;
        }
        const containerToRemove = gallery.querySelector(`.image-preview-container[data-image-id="${imageId}"]`);
        if (containerToRemove) {
            containerToRemove.remove();
            console.log(`UI: Removed image container for ${imageId}`);
            // Add back "No images" message if gallery becomes empty?
            if (gallery.querySelectorAll('.image-preview-container').length === 0) {
                 const noImagesMsg = document.createElement('p');
                 noImagesMsg.textContent = 'No images found for this product.';
                 gallery.appendChild(noImagesMsg);
            }
        } else {
            console.warn(`UI Warning: Could not find image container to remove for ID: ${imageId}`);
        }
    }, // End removeImagePreview

    // --- Crop Modal Logic ---
    cropperInstance: null, // To hold the Cropper.js instance
    croppedImageData: {}, // To temporarily store { imageId: blob }

    showCropModal: function(imageUrl, imageId) {
        if (!uiElements.cropModal || !uiElements.imageToCrop) {
            console.error("UI Error: Crop modal elements not found.");
            return;
        }
        console.log(`UI: Showing crop modal for image ID: ${imageId}`);
        uiElements.imageToCrop.src = imageUrl; // Set image source

        // Store imageId for later use (e.g., on confirm button)
        uiElements.confirmCropBtn.dataset.imageId = imageId;

        uiElements.cropModal.classList.remove('hidden');

        // Initialize Cropper.js (ensure image is loaded, might need slight delay or load event)
        // Destroy previous instance if exists
        if (this.cropperInstance) {
            this.cropperInstance.destroy();
        }
        // Using a small timeout to allow image to render before initializing cropper
        setTimeout(() => {
            if (uiElements.imageToCrop.naturalWidth > 0) { // Check if image has loaded dimensions
                 this.cropperInstance = new Cropper(uiElements.imageToCrop, {
                    aspectRatio: 1, // Example: Square crop, adjust as needed
                    viewMode: 1, // Restrict crop box to canvas
                    background: false, // Optional: hide grid background
                    autoCropArea: 0.8, // Initial crop area size
                    // Add other Cropper.js options here
                });
                console.log("UI: Cropper.js initialized.");
            } else {
                 console.error("UI Error: Image to crop did not load correctly before Cropper initialization.");
                 // Maybe retry or show error in modal?
            }
        }, 100); // 100ms delay, adjust if needed

    },

    hideCropModal: function() {
        if (this.cropperInstance) {
            this.cropperInstance.destroy();
            this.cropperInstance = null;
            console.log("UI: Cropper.js instance destroyed.");
        }
        if (uiElements.cropModal) {
            uiElements.cropModal.classList.add('hidden');
            uiElements.imageToCrop.src = ''; // Clear image source
            delete uiElements.confirmCropBtn.dataset.imageId; // Clear stored imageId
            console.log("UI: Crop modal hidden.");
        }
    }, // End hideCropModal

    // --- Update Product Status in Table ---
    updateProductStatusInTable: function(productId, status) {
        console.log(`UI: Updating status for product ${productId} in table to "${status}"`);
        const row = document.getElementById(`product-row-${productId}`);
        if (row) {
            const statusCell = row.querySelector('.status-cell');
            if (statusCell) {
                statusCell.textContent = status;
            } else {
                console.warn(`UI Warning: Status cell not found for product row ${productId}`);
            }
        } else {
             console.warn(`UI Warning: Product row not found for ID ${productId}`);
        }
    } // End updateProductStatusInTable

}; // This closing brace correctly ends uiManager


// --- Event Handlers Module ---
// Centralizes event listener logic
const eventHandlers = {
    handleUpcKeyPress: function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const upcValue = uiElements.upcInput?.value.trim(); // Add null checks
            if (upcValue) {
                apiService.scanUpc(upcValue);
                if (uiElements.upcInput) uiElements.upcInput.value = ''; // Clear input after sending
            } else {
                uiManager.updateStatus(uiElements.scanStatusMessage, 'Please scan or enter a UPC.');
            }
        }
    },

    handleRefreshClick: function() {
        apiService.fetchInventory();
    },

    handleSearchNameClick: function() {
        const searchTerm = uiElements.nameInput?.value.trim(); // Add null check
        if (searchTerm) {
            apiService.searchByName(searchTerm);
        } else {
            uiManager.updateStatus(uiElements.nameSearchStatusMessage, 'Please enter a name or description to search.');
        }
    },

    handleSearchImageClick: function() {
        const file = uiElements.imageInput?.files?.[0]; // Add null checks
        if (file) {
            uiManager.updateStatus(uiElements.imageSearchStatusMessage, `Uploading and searching image: ${file.name}... (Backend not implemented)`);
            console.log("Image file selected:", file);
            // Placeholder for actual image search call using apiService
            // const formData = new FormData();
            // formData.append('imageFile', file);
            // apiService.searchByImage(formData); // Need to implement searchByImage in apiService

            if (uiElements.imageInput) uiElements.imageInput.value = ''; // Reset file input
            alert("Image search backend needs to be implemented!");
        } else {
            uiManager.updateStatus(uiElements.imageSearchStatusMessage, 'Please select an image file first.');
        }
    },

    handleThemeToggleChange: function() {
        if (uiElements.themeToggle) { // Add null check
             uiManager.setTheme(uiElements.themeToggle.checked);
        }
    },

    handleViewEditClick: function(event) {
        const productId = event.target.dataset.productId;
        if (productId) {
            console.log(`Event: View/Edit clicked for product ID: ${productId}`);
            // Update hash to trigger view change (will be handled by hashchange listener)
            location.hash = `#product/${productId}`;
        } else {
            console.error("Event Error: Product ID not found on view/edit button.");
        }
    },

     handleProductSave: async function(event) {
        event.preventDefault(); // Prevent default form submission
        console.log("Event: Product Save initiated.");
        const form = event.target;
        const productId = form.dataset.productId; // Get ID from form dataset

        if (!productId) {
            console.error("Event Error: Cannot save, product ID missing from form.");
            uiManager.updateStatus(uiElements.resultsStatusMessage, "Error: Cannot save product, ID missing.");
            return;
        }

        // Gather data from form
        const formData = new FormData(form);

        // Image order is now included in formData via the hidden input named 'imageOrder'
        const imageOrderString = formData.get('imageOrder');
        console.log("Save Handler: Retrieved imageOrder string from FormData:", imageOrderString);

        // --- Handle Cropped Images ---
        // Check our temporary storage for cropped blobs
        let hasCroppedImages = false;
        for (const imageId in uiManager.croppedImageData) {
            if (uiManager.croppedImageData.hasOwnProperty(imageId)) {
                 const blob = uiManager.croppedImageData[imageId];
                 // Append blob to FormData. Backend needs to handle this.
                 // Use a consistent naming convention, e.g., 'croppedImage_{imageId}'
                 formData.append(`croppedImage_${imageId}`, blob, `cropped_${imageId}.jpg`);
                 console.log(`Save Handler: Appending cropped blob for image ${imageId}`);
                 hasCroppedImages = true;
            }
        }
        // Clear the temporary storage after appending
        uiManager.croppedImageData = {};
        // If we sent blobs, the backend needs to handle FormData correctly.
        // If not sending blobs directly, adjust API call (e.g., send JSON + separate upload?)

        uiManager.updateStatus(uiElements.resultsStatusMessage, `Saving product ${productId}...`);
        // Send the raw FormData object, which includes the imageOrder string and potentially cropped image blobs
        const success = await apiService.updateProduct(productId, formData); // Send FormData

        if (success) {
            uiManager.updateStatus(uiElements.resultsStatusMessage, `Product ${productId} saved successfully.`);
            // Navigate back to inventory view
            location.hash = '#inventory';
            // Optionally refresh inventory after save
            apiService.fetchInventory();
        } else {
             // Error message handled by apiService._fetchWithHandling
             uiManager.updateStatus(uiElements.resultsStatusMessage, `Failed to save product ${productId}.`);
        }
    },

    handleProductCancel: function() {
        console.log("Event: Product Cancel clicked.");
        // Navigate back to inventory view
        location.hash = '#inventory';
    },


    // --- Delegated Event Handlers for Detail View ---
    handleDetailViewChange: function(event) {
        // Check if the change event came from our file input
        if (event.target.matches('#product-image-upload')) {
            console.log("Event: Image Upload input changed.");
            eventHandlers.handleImageUpload(event); // Call specific upload handler
        }
        // Add other change handlers here if needed (e.g., category change triggers attribute reload)
    },

    handleDetailViewClick: function(event) {
        // Check for clicks on delete buttons
        if (event.target.matches('.delete-btn')) {
             console.log("Event: Delete Image button clicked.");
             eventHandlers.handleImageDelete(event); // Call specific delete handler
        }
        // Check for clicks on crop buttons
        else if (event.target.matches('.crop-btn')) {
             console.log("Event: Crop Image button clicked.");
             eventHandlers.handleImageCrop(event); // Call specific crop handler
        }
        // Check for clicks on the Enrich button (previously Populate with AI)
        else if (event.target.matches('.populate-ai-button')) { // Keep class selector for now, or update if class changed
            console.log("Event: Enrich button clicked in detail view.");
            eventHandlers.handleAiButtonClick(event); // Reverted handler name
        }
        // Add other click handlers here if needed
    },

     // --- Specific Handler for Image Upload ---
     handleImageUpload: async function(event) {
        const fileInput = event.target;
        const files = fileInput.files;
        if (!files || files.length === 0) {
            console.log("Upload Handler: No files selected.");
            return; // No files selected
        }

        const form = fileInput.closest('form#product-edit-form'); // Find the parent form
        if (!form) {
            console.error("Upload Handler Error: Could not find parent product form.");
            return;
        }
        const productId = form.dataset.productId;
        if (!productId) {
            console.error("Upload Handler Error: Could not find product ID on form.");
            return;
        }

        console.log(`Upload Handler: Uploading ${files.length} file(s) for product ${productId}...`);
        uiManager.updateStatus(uiElements.resultsStatusMessage, `Uploading ${files.length} image(s)...`); // Use main status for now

        // Disable input while uploading?
        fileInput.disabled = true;

        let uploadSuccess = true; // Track overall success
        const galleryContainer = document.getElementById('product-image-gallery'); // Get gallery container

        for (const file of files) {
            const formData = new FormData();
            formData.append('imageFile', file); // Backend expects 'imageFile'

            const newImageData = await apiService.uploadImage(productId, formData);

            if (newImageData) {
                console.log("Upload Handler: Successfully uploaded image, received data:", newImageData);
                // Update UI - Add image preview, update hidden order input
                uiManager.addImagePreview(newImageData, galleryContainer); // Pass container
                // Update the hidden order input value
                const hiddenOrderInput = form.querySelector('#product-image-order');
                if (hiddenOrderInput) {
                    try {
                        const currentOrder = JSON.parse(hiddenOrderInput.value || '[]');
                        // Ensure newImageData has an ID before pushing
                        if (newImageData.id) {
                             currentOrder.push(newImageData.id); // Add new image ID to the end
                             hiddenOrderInput.value = JSON.stringify(currentOrder);
                             console.log("Upload Handler: Updated hidden order input:", hiddenOrderInput.value);
                        } else {
                             console.error("Upload Handler Error: Uploaded image data missing 'id'. Cannot update order.");
                             uploadSuccess = false;
                        }
                    } catch (e) {
                        console.error("Upload Handler Error: Failed to parse or update image order.", e);
                        uploadSuccess = false;
                    }
                }
            } else {
                console.error(`Upload Handler Error: Failed to upload file: ${file.name}`);
                uiManager.updateStatus(uiElements.resultsStatusMessage, `Error uploading ${file.name}.`);
                uploadSuccess = false;
                // Optionally break the loop on first failure?
                // break;
            }
        }

        // Re-enable and clear the file input
        fileInput.disabled = false;
        fileInput.value = ''; // Clear the selected files

        if (uploadSuccess) {
             uiManager.updateStatus(uiElements.resultsStatusMessage, "Image upload complete.");
        } else {
             uiManager.updateStatus(uiElements.resultsStatusMessage, "Image upload finished with errors.");
        }
    },

    // --- Specific Handler for Image Delete ---
    handleImageDelete: async function(event) {
        const deleteButton = event.target;
        const imageId = deleteButton.dataset.imageId;
        const imgContainer = deleteButton.closest('.image-preview-container');
        const form = deleteButton.closest('form#product-edit-form');

        if (!imageId || !imgContainer || !form) {
            console.error("Delete Handler Error: Could not find image ID, container, or form.");
            return;
        }
        const productId = form.dataset.productId;
        if (!productId) {
             console.error("Delete Handler Error: Could not find product ID on form.");
             return;
        }

        // Confirmation dialog
        if (!confirm(`Are you sure you want to delete image ${imageId}? This cannot be undone.`)) {
            console.log("Delete Handler: Deletion cancelled by user.");
            return;
        }

        console.log(`Delete Handler: Deleting image ${imageId} for product ${productId}...`);
        uiManager.updateStatus(uiElements.resultsStatusMessage, `Deleting image ${imageId}...`);
        deleteButton.disabled = true; // Disable button during operation

        const success = await apiService.deleteImage(productId, imageId);

        if (success) {
            console.log(`Delete Handler: Successfully deleted image ${imageId}.`);
            uiManager.removeImagePreview(imageId); // Remove from UI

            // Update the hidden order input
            const hiddenOrderInput = form.querySelector('#product-image-order');
            if (hiddenOrderInput) {
                try {
                    let currentOrder = JSON.parse(hiddenOrderInput.value || '[]');
                    currentOrder = currentOrder.filter(id => id !== imageId); // Remove the deleted ID
                    hiddenOrderInput.value = JSON.stringify(currentOrder);
                    console.log("Delete Handler: Updated hidden order input:", hiddenOrderInput.value);
                } catch (e) {
                    console.error("Delete Handler Error: Failed to parse or update image order.", e);
                }
            }
             uiManager.updateStatus(uiElements.resultsStatusMessage, `Image ${imageId} deleted.`);

        } else {
            console.error(`Delete Handler Error: Failed to delete image ${imageId}.`);
            uiManager.updateStatus(uiElements.resultsStatusMessage, `Error deleting image ${imageId}.`);
            deleteButton.disabled = false; // Re-enable button on failure
        }
    },

    // --- Specific Handler for Image Crop Initiation ---
    handleImageCrop: function(event) {
        const cropButton = event.target;
        const imageId = cropButton.dataset.imageId;
        const imgContainer = cropButton.closest('.image-preview-container');
        const imgElement = imgContainer?.querySelector('img');

        if (!imageId || !imgElement) {
            console.error("Crop Handler Error: Could not find image ID or image element.");
            return;
        }
        const imageUrl = imgElement.src;
        console.log(`Crop Handler: Initiating crop for image ID: ${imageId}, URL: ${imageUrl}`);
        uiManager.showCropModal(imageUrl, imageId);
    },

    // --- Specific Handler for Confirming Crop ---
    handleConfirmCrop: function() {
        if (!uiManager.cropperInstance) {
            console.error("Confirm Crop Error: Cropper instance not found.");
            return;
        }
        const imageId = uiElements.confirmCropBtn.dataset.imageId;
        if (!imageId) {
             console.error("Confirm Crop Error: Image ID not found on confirm button.");
             return;
        }

        console.log(`Confirm Crop: Cropping image ID: ${imageId}`);
        // Get cropped data as a Blob
        uiManager.cropperInstance.getCroppedCanvas().toBlob(async (blob) => {
            if (blob) {
                console.log(`Confirm Crop: Generated Blob for ${imageId}`, blob);
                // Store the blob temporarily, associated with the imageId
                uiManager.croppedImageData[imageId] = blob;
                console.log("Confirm Crop: Stored cropped data:", uiManager.croppedImageData);

                // Visually indicate that the image has been edited
                const originalPreviewContainer = document.querySelector(`.image-preview-container[data-image-id="${imageId}"]`);
                if (originalPreviewContainer) {
                    originalPreviewContainer.style.border = '2px solid orange'; // Example indicator
                    originalPreviewContainer.dataset.edited = 'true'; // Mark as edited

                    // Update the preview thumbnail with the cropped version
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const previewImg = originalPreviewContainer.querySelector('img');
                        if (previewImg) previewImg.src = e.target.result;
                    }
                    reader.readAsDataURL(blob);
                }

            } else {
                console.error("Confirm Crop Error: Failed to generate Blob.");
                alert("Error cropping image. Please try again.");
            }
             // Hide modal regardless of blob success
             uiManager.hideCropModal();
        }, 'image/jpeg'); // Specify output format and quality if needed

    },

    // --- Specific Handler for Cancelling Crop ---
    handleCancelCrop: function() {
        console.log("Cancel Crop: Crop cancelled.");
        uiManager.hideCropModal();
    }, // Add comma here

    // --- Hash Routing Handler ---
    handleHashChange: function() {
        const hash = location.hash;
        console.log(`Event: Hash changed to: ${hash}`);

        if (hash.startsWith('#product/')) {
            const productId = hash.substring('#product/'.length);
            if (productId) {
                uiManager.displayProductDetails(productId);
            } else {
                 console.warn("Event Warning: Invalid product ID in hash.");
                 location.hash = '#inventory'; // Go back to safety
            }
        } else {
            // Default to inventory view for '#' or '#inventory' or any other hash
            uiManager.showView('inventory');
        }
    },

    // --- Specific Handler for AI Button Clicks ---
    handleAiButtonClick: async function(event) { // Renamed handler
        const button = event.target;
        let productId = button.dataset.productId;
        let productUpc = button.dataset.upc;
        let productTitle = button.dataset.title;
        let originalButtonText = 'USE AI'; // Default for table button

        // If clicked in detail view, get data from form fields instead of button dataset
        const form = button.closest('form#product-edit-form');
        if (form) {
            productId = form.dataset.productId;
            productUpc = form.querySelector('#product-upc')?.value || '';
            productTitle = form.querySelector('#product-title')?.value || '';
            originalButtonText = 'Populate with AI'; // Text for detail view button
            console.log("AI Button Handler: Clicked in detail view.");
        } else {
             console.log("AI Button Handler: Clicked in inventory table.");
        }


        if (!productId || (!productUpc && !productTitle)) {
             console.error("AI Button Handler Error: Missing required data (id and upc/title).", { id: productId, upc: productUpc, title: productTitle });
             uiManager.updateStatus(uiElements.resultsStatusMessage, "Error: Cannot trigger AI, missing product data."); // Updated message
             return;
        }

        console.log(`AI Button Handler: Triggered for product ${productId}`);
        button.disabled = true; // Disable button during call
        button.textContent = 'Processing...'; // Generic processing text
        // Update status in the table immediately if clicked there
        if (!form) {
            uiManager.updateProductStatusInTable(productId, 'AI Processing...'); // Use updated status text
        }
        uiManager.updateStatus(uiElements.resultsStatusMessage, `Initiating AI processing for product ${productId}...`); // Updated message

        const productData = {
            id: productId,
            upc: productUpc,
            name: productTitle // API function expects 'name' field
        };

        await apiService.callAiWebhook(productData); // Call renamed API function

        // Re-enable button and restore text after call completes (success or fail)
        // Note: Status update (success/fail) is handled within enrichProductViaWebhook now
        button.disabled = false;
        button.textContent = 'Enrich';
    }

}; // This closing brace correctly ends eventHandlers


// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    // Assign dynamic elements if needed (like the detail view container)
    uiElements.productDetailView = document.getElementById('product-detail-view');
    if (!uiElements.productDetailView) {
        console.error("CRITICAL INIT ERROR: #product-detail-view element not found in HTML!");
        // Create it dynamically as a fallback
        const errorDiv = document.createElement('div');
        errorDiv.id = 'product-detail-view';
        errorDiv.innerHTML = '<h2 style="color: red;">Error: Detail view container missing in HTML.</h2>';
        errorDiv.classList.add('hidden'); // Keep it hidden initially
        document.querySelector('.container')?.appendChild(errorDiv); // Append to main container
        uiElements.productDetailView = errorDiv;
    }


    // Initial Setup
    uiManager.loadTheme();

    // Attach Event Listeners using handlers (with null checks for elements)
    if (uiElements.upcInput) uiElements.upcInput.addEventListener('keypress', eventHandlers.handleUpcKeyPress);
    if (uiElements.refreshInventoryBtn) uiElements.refreshInventoryBtn.addEventListener('click', eventHandlers.handleRefreshClick);
    if (uiElements.searchByNameBtn) uiElements.searchByNameBtn.addEventListener('click', eventHandlers.handleSearchNameClick);
    if (uiElements.searchByImageBtn) uiElements.searchByImageBtn.addEventListener('click', eventHandlers.handleSearchImageClick);
    if (uiElements.themeToggle) uiElements.themeToggle.addEventListener('change', eventHandlers.handleThemeToggleChange);
    // Crop Modal Button Listeners
    if (uiElements.confirmCropBtn) uiElements.confirmCropBtn.addEventListener('click', eventHandlers.handleConfirmCrop);
    if (uiElements.cancelCropBtn) uiElements.cancelCropBtn.addEventListener('click', eventHandlers.handleCancelCrop);
    if (uiElements.closeCropModalBtn) uiElements.closeCropModalBtn.addEventListener('click', eventHandlers.handleCancelCrop); // Close button also cancels


    // Listener for delegated events within the detail view (like image uploads, deletes, crops)
    if (uiElements.productDetailView) {
        // Listen on the container for events bubbling up from dynamic elements
        uiElements.productDetailView.addEventListener('change', eventHandlers.handleDetailViewChange);
        uiElements.productDetailView.addEventListener('click', eventHandlers.handleDetailViewClick); // Add click listener too for buttons
    }

    uiElements.toggleButtons.forEach(button => {
        button.addEventListener('click', uiManager.handleToggleClick); // UI manager handles the direct toggle logic
    });

    // Hash change listener for view swapping
    window.addEventListener('hashchange', eventHandlers.handleHashChange);

    // Initial view load based on hash or default
    eventHandlers.handleHashChange(); // Trigger initial view check

    // Load initial inventory if starting on inventory view
    if (!location.hash || location.hash === '#inventory') {
        apiService.fetchInventory();
    }

});
