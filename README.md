# Produx - Project & Task Management App

Produx is a modern, intuitive task management application for organizing projects, tasks, and notes with a clean hierarchical interface. It's designed to help users manage their projects with a flexible and powerful system for tracking tasks, notes, and attachments.

## 🌟 Features

### Project Management
- Create and manage multiple projects
- View project dashboards with task completion statistics
- Organize tasks and notes hierarchically within projects

### Task & Note System
- Create both checklist items (tasks) and notes
- Nested hierarchy with parent-child relationships
- Visual task organization with subtle blue indentation lines
- Auto-complete parent tasks when all child tasks are completed
- Mark tasks as complete/incomplete with confirmation for bulk actions

### Rich Content Support
- Attach images to tasks and notes
- Automatically extract and link URLs found in task/note text
- Preview attached images with expandable viewer
- Responsive design that adapts to both desktop and mobile

### User Experience
- Clean, modern UI using shadcn/ui components
- Responsive design with mobile-optimized view (icon-only buttons on small screens)
- Efficient space use for deeply nested items
- Authentication powered by Supabase

## 🛠️ Technology Stack

### Frontend
- **React**: UI library for building the user interface
- **TypeScript**: For type safety across the application
- **Vite**: Build tool for fast development and optimized production builds
- **React Router**: For application routing
- **TanStack Query (React Query)**: For data fetching and state management
- **Tailwind CSS**: For styling and responsive design
- **shadcn/ui**: Component library built on Radix UI
- **Lucide React**: Modern icon set

### Backend & Data Storage
- **Supabase**: Backend as a service platform providing:
  - Authentication
  - PostgreSQL database
  - Storage for images and files
  - Realtime capabilities

### Database Schema
- **Projects**: Store project metadata (title, description, user)
- **Items**: Individual tasks and notes, with hierarchical relationships
- **Item Attachments**: Store links to images and URLs attached to items

## 🚀 Getting Started

### Prerequisites
- Node.js (14.x or later)
- pnpm (preferred) or npm

### Installation

1. Clone the repository:
```sh
git clone https://github.com/yourusername/produx.git
cd produx
```

2. Install dependencies:
```sh
pnpm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```sh
pnpm dev
```

## 🔧 Project Structure

```
produx/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── ui/          # shadcn/ui components
│   │   └── ...          # Application-specific components
│   ├── hooks/           # Custom React hooks
│   ├── integrations/    # External service integrations (Supabase)
│   ├── lib/             # Utility functions
│   ├── pages/           # Page components
│   └── types/           # TypeScript type definitions
├── .env                 # Environment variables
└── ...                  # Configuration files
```

## 📱 Mobile Optimization

The app is optimized for mobile use with:
- Responsive layouts that adapt to screen size
- Compact UI elements on small screens
- Space-efficient indentation for nested items
- Touch-friendly UI elements
- Icon-only buttons on small screens to save space

## 🔄 Development Workflow

1. Create feature branches from `main`
2. Make changes and test locally
3. Push changes and create a pull request
4. Once approved, merge the feature branch into `main`

## 🔐 Authentication

Authentication is handled through Supabase, providing:
- Email/password authentication
- Session management
- Protected routes

## 🗄️ Database Schema

The application uses the following database tables:

### Projects
- `id`: UUID
- `title`: String
- `description`: String (optional)
- `user_id`: UUID
- `created_at`: Timestamp
- `updated_at`: Timestamp

### Items
- `id`: UUID
- `project_id`: UUID (foreign key to Projects)
- `parent_id`: UUID (self-reference for hierarchy, nullable)
- `content`: String
- `is_checklist`: Boolean
- `is_completed`: Boolean
- `position`: Integer (for ordering)
- `created_at`: Timestamp
- `updated_at`: Timestamp

### Item Attachments
- `id`: UUID
- `item_id`: UUID (foreign key to Items)
- `attachment_type`: String (e.g., 'image', 'url')
- `url`: String
- `label`: String (optional)
- `created_at`: Timestamp

## 🙏 Acknowledgements

This project uses various open-source libraries and tools, including React, TypeScript, Tailwind CSS, shadcn/ui, Supabase, and more.

## 📝 Development Branch

This branch (`feature/development`) was created on March 19, 2024, as the starting point for new development work. All future changes will be made through feature branches and merged back to this branch after review.
