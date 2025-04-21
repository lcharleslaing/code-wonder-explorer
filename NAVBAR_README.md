# Navbar with Side Drawer Implementation

This project includes a responsive navbar with a side drawer for mobile navigation. The implementation includes both React-based and HTMX-based approaches.

## Components Overview

### React Components

1. **Navbar Component (`src/components/Navbar.tsx`)**
   - Fixed navbar that shows at the top of the page
   - Responsive design - shows full navigation on desktop, shows menu button on mobile
   - Scroll effect changes appearance when scrolling down
   - Menu button triggers the side drawer on mobile

2. **SideDrawer Component (`src/components/SideDrawer.tsx`)**
   - Off-canvas navigation drawer for mobile devices
   - Appears from the left when menu button is clicked
   - Backdrop with blur effect
   - Close button and ESC key to dismiss
   - Navigation links with icons
   - Prevents background scrolling when drawer is open

3. **Layout Component (`src/components/Layout.tsx`)**
   - Wraps the app with the Navbar and SideDrawer
   - Manages the state for opening/closing the drawer

### HTMX Demo Component

1. **HtmxSideDrawer Component (`src/components/HtmxSideDrawer.tsx`)**
   - Demonstrates how to implement the same functionality using HTMX
   - Uses HTMX attributes for triggering drawer open/close
   - Shows how to handle navigation and events
   - Includes a template for server-rendered content
   - Note: This is a demonstration component and requires backend endpoints to function properly

## How to Use

### React Implementation

The React implementation is already integrated into the app. The `Layout` component is used as a wrapper in `App.tsx`:

```jsx
<Route element={<Layout />}>
  <Route path="/" element={<ProjectDashboard />} />
  <Route path="/projects/:id" element={<ProjectPage />} />
</Route>
```

### HTMX Implementation

To use the HTMX implementation:

1. Add HTMX to your project:
   ```html
   <script src="https://unpkg.com/htmx.org@2.0.4" integrity="sha384-HGfztofotfshcF7+8n44JQL2oJmowVChPTg48S+jvZoztPfvwD79OC/LTtG6dMp+" crossorigin="anonymous"></script>
   ```

2. Create the following API endpoints on your server:
   - `/api/side-drawer` - Returns the HTML for the drawer
   - `/api/close-drawer` - Returns empty content to close the drawer

3. Use the `HtmxSideDrawer` component in your layout

## Design Details

- The navbar is fixed to the top and has a scroll effect
- Side drawer has a smooth transition animation
- Mobile-first approach with responsive breakpoints
- Uses Tailwind CSS for styling
- Icons from Lucide (SVG inline)

## Accessibility Features

- Proper ARIA labels on menu and close buttons
- Keyboard navigation support (ESC to close drawer)
- Focus management within the drawer
- Screen reader friendly structure

## Customization

You can customize the appearance by:

1. Modifying the Tailwind classes in the component files
2. Changing the icons (SVG paths)
3. Adjusting the drawer width by changing the `w-72` class
4. Modifying transitions by changing the `duration-300` classes

## HTMX vs React Approach

### React Approach Benefits
- Client-side state management
- No server endpoints needed for UI interactions
- Better integration with existing React codebase

### HTMX Approach Benefits
- Less JavaScript
- More server-driven UI
- Progressive enhancement
- Potentially better performance for some use cases

Choose the approach that best fits your project's architecture and requirements.