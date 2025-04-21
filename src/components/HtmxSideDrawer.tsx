import { Link } from "react-router-dom";

// This component shows how to implement a side drawer using HTMX principles
// Note: This is an example for demonstration, not directly used in the main app

export function HtmxSideDrawer() {
  return (
    <>
      {/* Trigger Button */}
      <button
        className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        hx-get="/api/side-drawer"
        hx-trigger="click"
        hx-target="#drawer-container"
        aria-label="Open menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>

      {/* Drawer Container - HTMX will swap content here */}
      <div id="drawer-container"></div>

      {/* Drawer Content (This would normally be returned from the server) */}
      <template id="side-drawer-template">
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          hx-on:click="htmx.trigger('#close-button', 'click')"
        >
          <div
            className="fixed inset-y-0 left-0 z-50 w-72 bg-background shadow-lg p-6 transform transition-transform duration-300 ease-in-out"
            hx-on:click="event.stopPropagation()"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold">Menu</h2>
              <button
                id="close-button"
                className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                hx-get="/api/close-drawer"
                hx-target="#drawer-container"
                hx-swap="outerHTML"
                aria-label="Close menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <nav className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Navigation</h3>
                <div className="space-y-2">
                  <Link
                    to="/"
                    className="flex items-center py-2 text-sm font-medium hover:text-primary transition-colors"
                    hx-boost="true"
                    hx-push-url="true"
                    hx-target="body"
                    hx-trigger="click"
                    hx-on:after-request="document.getElementById('close-button').click()"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    Dashboard
                  </Link>
                  <Link
                    to="/projects"
                    className="flex items-center py-2 text-sm font-medium hover:text-primary transition-colors"
                    hx-boost="true"
                    hx-push-url="true"
                    hx-target="body"
                    hx-trigger="click"
                    hx-on:after-request="document.getElementById('close-button').click()"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <path d="M3 3v18h18" />
                      <path d="M18.4 9.4 8.5 19.2" />
                      <path d="m10.8 7.8 7.9-7.9 6.4 6.4-7.9 7.9" />
                    </svg>
                    Projects
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center py-2 text-sm font-medium hover:text-primary transition-colors"
                    hx-boost="true"
                    hx-push-url="true"
                    hx-target="body"
                    hx-trigger="click"
                    hx-on:after-request="document.getElementById('close-button').click()"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Settings
                  </Link>
                </div>
              </div>

              <div className="pt-4 border-t">
                <a
                  href="/auth"
                  className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                  hx-boost="true"
                  hx-push-url="true"
                  hx-target="body"
                >
                  Login / Sign Up
                </a>
              </div>
            </nav>
          </div>
        </div>
      </template>

      {/* This script would be used in a real application to initialize HTMX */}
      {/*
      <script>
        // Simulate the server endpoint for demo purposes
        document.body.addEventListener('htmx:configRequest', function(evt) {
          if (evt.detail.path === '/api/side-drawer') {
            evt.detail.shouldProcessRequest = false;
            const template = document.getElementById('side-drawer-template');
            const drawerContainer = document.getElementById('drawer-container');
            drawerContainer.innerHTML = template.innerHTML;
          } else if (evt.detail.path === '/api/close-drawer') {
            evt.detail.shouldProcessRequest = false;
            const drawerContainer = document.getElementById('drawer-container');
            drawerContainer.innerHTML = '';
          }
        });
      </script>
      */}
    </>
  );
}