/**
 * ShareModal Component
 * Modal for sharing dashboard link via copy or email
 */

import { useState } from 'react';
import { clsx } from 'clsx';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareableUrl: string;
}

type ShareTab = 'link' | 'email';

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function buildMailtoUrl(recipients: string[], subject: string, body: string): string {
  const to = recipients.join(',');
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
}

export function ShareModal({ isOpen, onClose, shareableUrl }: ShareModalProps) {
  const [activeTab, setActiveTab] = useState<ShareTab>('link');
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'error'>('idle');

  // Email form state
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('Screenplay Analysis from Lemon Dashboard');
  const [message, setMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopyFeedback('copied');
      setTimeout(() => setCopyFeedback('idle'), 2000);
    } catch {
      setCopyFeedback('error');
      setTimeout(() => setCopyFeedback('idle'), 2000);
    }
  };

  const handleSendEmail = () => {
    // Parse and validate recipients
    const emailList = recipients
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (emailList.length === 0) {
      setEmailError('Please enter at least one email address');
      return;
    }

    const invalidEmails = emailList.filter(e => !validateEmail(e));
    if (invalidEmails.length > 0) {
      setEmailError(`Invalid email(s): ${invalidEmails.join(', ')}`);
      return;
    }

    setEmailError('');

    // Build email body with message and link
    const emailBody = `${message ? message + '\n\n' : ''}View the screenplay analysis:\n${shareableUrl}`;

    // Open email client
    const mailtoUrl = buildMailtoUrl(emailList, subject, emailBody);
    window.open(mailtoUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg glass border border-gold-500/20 rounded-xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black-700">
          <h3 className="text-lg font-display text-gold-200">Share Dashboard</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-black-700 text-black-400 hover:text-gold-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-black-700">
          <button
            onClick={() => setActiveTab('link')}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'link'
                ? 'text-gold-400 border-b-2 border-gold-400 bg-gold-500/5'
                : 'text-black-400 hover:text-black-200'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Copy Link
            </div>
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'email'
                ? 'text-gold-400 border-b-2 border-gold-400 bg-gold-500/5'
                : 'text-black-400 hover:text-black-200'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === 'link' ? (
            <div className="space-y-4">
              <p className="text-sm text-black-400">
                Copy the link below to share the current dashboard view with your filters applied.
              </p>

              {/* URL Preview */}
              <div className="p-3 bg-black-900/50 rounded-lg">
                <code className="text-xs text-black-300 break-all">{shareableUrl}</code>
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopyLink}
                className={clsx(
                  'w-full btn',
                  copyFeedback === 'copied' ? 'btn-primary bg-emerald-500 border-emerald-500' : 'btn-primary'
                )}
              >
                {copyFeedback === 'copied' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied to Clipboard!
                  </>
                ) : copyFeedback === 'error' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Failed to Copy
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Link
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-black-400">
                Send the dashboard link via email. Add a personal note to explain why you're sharing this screenplay analysis.
              </p>

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-black-300 mb-1">
                  Recipients <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={recipients}
                  onChange={(e) => {
                    setRecipients(e.target.value);
                    setEmailError('');
                  }}
                  placeholder="email@example.com, another@example.com"
                  className="input"
                />
                <p className="text-xs text-black-500 mt-1">
                  Separate multiple emails with commas
                </p>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-black-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-black-300 mb-1">
                  Your Note
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Here's a screenplay I think you should check out..."
                  rows={3}
                  className="input resize-none"
                />
                <p className="text-xs text-black-500 mt-1">
                  Explain why you're sending this screenplay analysis
                </p>
              </div>

              {/* Error Message */}
              {emailError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{emailError}</p>
                </div>
              )}

              {/* Send Button */}
              <button
                onClick={handleSendEmail}
                className="w-full btn btn-primary"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Open in Email Client
              </button>

              <p className="text-xs text-black-500 text-center">
                This will open your default email application
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-black-700 bg-black-900/30">
          <button onClick={onClose} className="btn btn-ghost">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShareModal;
