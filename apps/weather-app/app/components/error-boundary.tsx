import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // console.error('CityRankings failed', error, info);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <p role="alert" className="mt-6 text-text">
          Something went wrong while fetching the rankings. Please try again later.
        </p>
      );
    }
    return this.props.children;
  }
}
