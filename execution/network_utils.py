#!/usr/bin/env python3
"""
Network Utilities for Lemon Screenplay Dashboard

Centralized network configuration, retry logic, and error handling.
"""

import logging
import socket
from typing import Tuple, Type
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
    RetryCallState
)

logger = logging.getLogger(__name__)

# Standard network timeout (seconds)
DEFAULT_CONNECT_TIMEOUT = 10
DEFAULT_READ_TIMEOUT = 120

# Retry configuration
MAX_RETRIES = 5
MIN_WAIT = 4
MAX_WAIT = 60
EXPONENTIAL_MULTIPLIER = 2


def log_retry_attempt(retry_state: RetryCallState) -> None:
    """Log detailed retry information."""
    exception = retry_state.outcome.exception() if retry_state.outcome else None
    attempt = retry_state.attempt_number

    if exception:
        exc_type = type(exception).__name__
        exc_msg = str(exception)[:200]  # Truncate long messages
        logger.warning(
            f"Retry attempt {attempt}/{MAX_RETRIES} after {exc_type}: {exc_msg}"
        )


def is_retryable_http_status(status_code: int) -> bool:
    """Determine if HTTP status code is retryable."""
    return status_code in (408, 429, 500, 502, 503, 504, 529)


def format_network_error(exception: Exception) -> str:
    """Format network errors for user-friendly logging."""
    exc_type = type(exception).__name__

    error_messages = {
        'APIConnectionError': 'Network connection failed - check internet connectivity',
        'APITimeoutError': 'Request timed out - API may be slow or overloaded',
        'RateLimitError': 'Rate limit exceeded - too many requests',
        'ServiceUnavailableError': 'Service temporarily unavailable',
        'OverloadedError': 'API is overloaded - try again later',
        'ConnectError': 'Failed to connect to server',
        'TimeoutException': 'Connection timed out',
        'socket.timeout': 'Socket timeout - network is slow',
        'ConnectionRefusedError': 'Connection refused - server may be down',
        'gaierror': 'DNS resolution failed - check network settings',
        'SSLCertVerificationError': 'SSL certificate verification failed',
        'HttpError': 'HTTP request failed',
        'TransportError': 'Network transport error',
    }

    return error_messages.get(exc_type, f'Network error: {exc_type}')


def create_retry_decorator(
    max_attempts: int = MAX_RETRIES,
    min_wait: int = MIN_WAIT,
    max_wait: int = MAX_WAIT,
    retryable_exceptions: Tuple[Type[Exception], ...] = None
):
    """
    Create a tenacity retry decorator with standard configuration.

    Args:
        max_attempts: Maximum number of retry attempts
        min_wait: Minimum wait time between retries (seconds)
        max_wait: Maximum wait time between retries (seconds)
        retryable_exceptions: Tuple of exception types to retry on

    Returns:
        Configured tenacity retry decorator
    """
    if retryable_exceptions is None:
        retryable_exceptions = (
            ConnectionError,
            TimeoutError,
            socket.timeout,
            OSError,
        )

    return retry(
        retry=retry_if_exception_type(retryable_exceptions),
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=EXPONENTIAL_MULTIPLIER, min=min_wait, max=max_wait),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True
    )


class NetworkDiagnostics:
    """Utilities for diagnosing network issues."""

    @staticmethod
    def test_dns_resolution(hostname: str = 'api.anthropic.com') -> bool:
        """Test if DNS resolution works."""
        try:
            socket.gethostbyname(hostname)
            return True
        except socket.gaierror:
            return False

    @staticmethod
    def test_connectivity(host: str = 'api.anthropic.com', port: int = 443) -> bool:
        """Test if we can connect to a host."""
        try:
            sock = socket.create_connection((host, port), timeout=5)
            sock.close()
            return True
        except (socket.timeout, socket.error, OSError):
            return False

    @staticmethod
    def run_diagnostics() -> dict:
        """Run full network diagnostics."""
        results = {
            'dns_anthropic': NetworkDiagnostics.test_dns_resolution('api.anthropic.com'),
            'dns_google': NetworkDiagnostics.test_dns_resolution('www.googleapis.com'),
            'dns_openai': NetworkDiagnostics.test_dns_resolution('api.openai.com'),
            'connect_anthropic': NetworkDiagnostics.test_connectivity('api.anthropic.com'),
            'connect_google': NetworkDiagnostics.test_connectivity('www.googleapis.com'),
            'connect_openai': NetworkDiagnostics.test_connectivity('api.openai.com'),
        }

        all_ok = all(results.values())
        results['status'] = 'OK' if all_ok else 'ISSUES_DETECTED'

        return results

    @staticmethod
    def print_diagnostics():
        """Print formatted network diagnostics."""
        results = NetworkDiagnostics.run_diagnostics()

        print("\n=== Network Diagnostics ===")
        print(f"Overall Status: {results['status']}")
        print()
        print("DNS Resolution:")
        print(f"  Anthropic API: {'✓' if results['dns_anthropic'] else '✗'}")
        print(f"  Google APIs:   {'✓' if results['dns_google'] else '✗'}")
        print(f"  OpenAI API:    {'✓' if results['dns_openai'] else '✗'}")
        print()
        print("Connectivity:")
        print(f"  Anthropic API: {'✓' if results['connect_anthropic'] else '✗'}")
        print(f"  Google APIs:   {'✓' if results['connect_google'] else '✗'}")
        print(f"  OpenAI API:    {'✓' if results['connect_openai'] else '✗'}")
        print("=" * 28)

        if results['status'] != 'OK':
            print("\nTroubleshooting tips:")
            if not results['dns_anthropic'] or not results['dns_google']:
                print("  - DNS issues detected. Check your network connection.")
                print("  - Try running: ping -c 1 8.8.8.8")
            if not results['connect_anthropic']:
                print("  - Cannot connect to Anthropic. Check firewall settings.")
            if not results['connect_google']:
                print("  - Cannot connect to Google. Check firewall settings.")


if __name__ == "__main__":
    # Run diagnostics when executed directly
    NetworkDiagnostics.print_diagnostics()
