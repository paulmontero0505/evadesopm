import { Component } from 'react'

/** Evita que un error inesperado de una pantalla deje la aplicación en blanco. */
export default class AppErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Error de interfaz:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="content app-error-state" role="alert">
          <div className="card">
            <h2>No se pudo mostrar esta pantalla</h2>
            <p className="muted">Actualiza la página o vuelve al inicio para intentarlo nuevamente.</p>
            <div className="row">
              <button className="btn" onClick={() => window.location.reload()}>Actualizar página</button>
              <button className="btn secondary" onClick={() => this.setState({ hasError: false }, () => { window.location.hash = '#/' })}>Ir al inicio</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
