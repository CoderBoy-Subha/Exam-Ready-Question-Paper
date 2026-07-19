import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { store } from './store/store.js'
import App from './App.jsx'
import StepPanel from './components/StepPanel.jsx'
import RouteError from './components/RouteError.jsx'
import Home from './components/Home.jsx'
import UploadStep from './components/UploadStep.jsx'
import ConfigStep from './components/ConfigStep.jsx'
import PaperResult from './components/PaperResult.jsx'
import './styles/theme.css'
import './styles/animations.css'
import './styles/components.css'

const router = createBrowserRouter([
  {
    element: <App />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      {
        element: <StepPanel />,
        children: [
          { path: 'upload', element: <UploadStep /> },
          { path: 'configure', element: <ConfigStep /> },
          { path: 'paper/:generationId', element: <PaperResult /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>,
)
