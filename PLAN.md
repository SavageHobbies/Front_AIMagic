# Frontend Improvement Plan: Product View/Edit Feature

## 1. Initial Analysis Summary

Based on reviewing `index.html`, `styles.css`, and `script.js`:

*   **HTML (`index.html`):** Clear, semantic structure with input sections and an inventory table containing an "Actions" column.
*   **CSS (`styles.css`):** Well-organized using CSS variables for theming (light/dark) and responsiveness. Styles table action buttons.
*   **JavaScript (`script.js`):**
    *   Vanilla JS, procedural approach within `DOMContentLoaded`.
    *   Handles UI interactions (theme, input toggles).
    *   Manages API calls (`fetch`) to n8n webhooks (inventory, scan, search). Basic error handling present.
    *   Dynamically builds the inventory table via DOM manipulation.
    *   "View/Edit" button functionality is currently a placeholder (`alert`).
    *   Configuration (webhook URLs) is hardcoded.

## 2. Core Task & Requirements

Implement a view/edit feature for products listed in the inventory table, allowing users to:

*   View detailed product information.
*   Edit product attributes.
*   Handle dynamic form fields based on product category.
*   Manage product images:
    *   View main and additional images (up to 12).
    *   Upload new images.
    *   Delete existing images.
    *   Reorder images (drag-and-drop) for eBay listing purposes.
    *   Perform basic image cropping.
*   Select the product's category.
*   Save changes via API calls (`PUT /api/products/:id`).
*   Integrate with a backend providing REST APIs (e.g., `GET /api/products/:id`, `PUT /api/products/:id`, `GET /api/categories`, image endpoints).

## 3. Recommended Implementation Strategy: View Swapping

*   **Approach:** Use hash-based routing (`index.html#product/{id}`) within the existing `index.html` to swap between the main inventory view and a dedicated product detail view (`<section id="product-detail-view">`).
*   **Rationale:** Offers better separation for the complex detail view logic compared to a simple modal, handles dynamic content generation more cleanly, and maintains a Single Page Application feel without full page reloads.

## 4. Phased Implementation Plan

### Phase 1: Refactor JS & Implement View Swapping

1.  **Refactor JS:** Implement a modular structure (e.g., `apiService`, `uiManager`, `eventHandlers`) to organize the code better. Move configuration constants.
2.  **Implement View Swapping:**
    *   Add the `#product-detail-view` section (initially hidden) to `index.html`.
    *   Implement basic hash-based routing logic in JS to show/hide the inventory and detail views based on the URL hash (`#inventory`, `#product/{id}`).
    *   Modify the "View/Edit" button's click handler to update the hash (`location.hash = '#product/' + productId`) and trigger the view switch.

### Phase 2: Develop Detail View (Core)

1.  **API Service:** Add functions to `apiService` for:
    *   Fetching single product details (`GET /api/products/:id`).
    *   Fetching categories (`GET /api/categories`).
2.  **UI Manager:** Create/enhance the `displayProductDetails` function in `uiManager`:
    *   Fetch product data and categories using `apiService`.
    *   Dynamically generate form fields within `#product-detail-view` based on product data/category (start with common fields).
    *   Populate a category `<select>` dropdown.
    *   Display existing images (read-only initially).
    *   Add "Save" and "Cancel" buttons. (Cancel button should set `location.hash = '#inventory'`).

### Phase 3: Implement Editing & Saving

1.  **API Service:** Add the `updateProduct` function (`PUT /api/products/:id`) to `apiService`. This endpoint must accept product data, image order, and potentially cropped image data.
2.  **Event Handling:** Add an event listener for the "Save" button:
    *   Gather data from dynamically generated fields.
    *   Call `apiService.updateProduct`.
    *   Handle success/error (update UI, show messages, navigate back to inventory view on success).

### Phase 4: Implement Image Management & Basic Crop

1.  **Display & Reorder:**
    *   Display existing images within the detail view.
    *   Implement drag-and-drop reordering for images (e.g., using SortableJS or native Drag and Drop API). Ensure this updates an internal representation of the image order.
2.  **Upload & Delete:**
    *   Add file input(s) for image uploads.
    *   Add delete buttons for existing images.
    *   Implement corresponding `apiService` functions (`POST /api/products/:id/images`, `DELETE /api/products/:id/images/:imageId`).
    *   Update `uiManager` to handle image previews, uploads, and deletions, reflecting changes in the UI.
3.  **Integrate Basic Cropping:**
    *   Include a cropping library (e.g., `Cropper.js`).
    *   Add an "Edit/Crop" button per image.
    *   On click, initialize the cropper in a modal.
    *   On confirmation, get the cropped Blob, store it temporarily client-side, and mark the image as edited.
4.  **Modify Save Logic:** Enhance the "Save" button logic (from Phase 3) to:
    *   Identify images marked as edited.
    *   Include any stored cropped image Blobs along with product data and image order in the `updateProduct` API call (likely using `FormData`).

### Phase 5: (Deferred) Advanced Photo Editor Features

*   Integrate more advanced features like rotation, filters, brightness/contrast as a separate, subsequent task.

## 5. High-Level Flow Diagrams

### Main View Swapping Flow

```mermaid
graph TD
    A[User Clicks View/Edit on Product X] --> B{Update URL Hash to #product/X};
    B --> C{JS: Detect Hash Change};
    C --> D[JS: Hide Inventory View];
    C --> E[JS: Show Detail View Container];
    E --> F[apiService: Fetch Product X Details];
    E --> G[apiService: Fetch Categories];
    F & G --> H[uiManager: Dynamically Build Form (Fields, Images, Category Select)];
    H --> I[User Interacts (Edits Fields, Selects Category, Manages Images)];
    I -- Clicks Save --> J{JS: Gather Form Data + Image Order + Cropped Blobs};
    J --> K[apiService: PUT /api/products/X];
    K -- Success --> L[uiManager: Show Success, Update Inventory (Optional), Navigate to #inventory];
    K -- Error --> M[uiManager: Show Error Message];
    I -- Clicks Cancel --> N{Update URL Hash to #inventory};
    N --> O{JS: Detect Hash Change};
    O --> P[JS: Hide Detail View];
    O --> Q[JS: Show Inventory View];
```

### Detail View Image Interaction & Save Flow

```mermaid
graph TD
    subgraph Detail View Interaction
        direction TB
        I1[Edit Text Fields]
        I2[Select Category]
        I3[Upload New Image] --> I3a[apiService: POST Image]
        I4[Delete Existing Image] --> I4a[apiService: DELETE Image]
        I5[Drag & Drop to Reorder Images] --> I5a[JS: Update Internal Image Order Array]
        I6[Click Edit/Crop on Image] --> I6a[JS: Open Crop Modal with Cropper.js]
        I6a --> I6b[User Adjusts Crop & Confirms]
        I6b --> I6c[JS: Get Cropped Blob, Store Locally, Mark Image as Edited]
    end

    I[User Interacts] --> Detail View Interaction;
    I -- Clicks Save --> J{JS: Gather Form Data + Image Order + Any Cropped Image Blobs};
    J --> K[apiService: PUT /api/products/X (using FormData if Blobs exist)];
    K -- Success --> L[uiManager: Show Success, Update Inventory (Optional), Navigate to #inventory];
    K -- Error --> M[uiManager: Show Error Message];