/**
 * Calibration Panel — Settings panel for the Adaptive Learning system.
 *
 * Allows the admin to:
 * - View and edit the generated calibration prompt
 * - Recalibrate from accumulated feedback
 * - Toggle calibration on/off for future analyses
 * - See feedback statistics
 */

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
    loadAllFeedback,
    loadCalibrationProfile,
    saveCalibrationProfile,
    synthesizeCalibrationPrompt,
    type CalibrationProfile,
} from '@/lib/feedbackStore';

export function CalibrationPanel() {
    const [profile, setProfile] = useState<CalibrationProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [recalibrating, setRecalibrating] = useState(false);
    const [feedbackCount, setFeedbackCount] = useState(0);
    const [promptText, setPromptText] = useState('');
    const [enabled, setEnabled] = useState(false);

    // Load profile and feedback count on mount
    useEffect(() => {
        async function load() {
            const [existingProfile, allFeedback] = await Promise.all([
                loadCalibrationProfile(),
                loadAllFeedback(),
            ]);

            setFeedbackCount(allFeedback.length);

            if (existingProfile) {
                setProfile(existingProfile);
                setPromptText(existingProfile.calibrationPrompt);
                setEnabled(existingProfile.enabled);
            } else {
                // Generate initial profile from existing feedback
                const synthesized = synthesizeCalibrationPrompt(allFeedback);
                setPromptText(synthesized);
                setEnabled(false);
            }

            setLoading(false);
        }
        load();
    }, []);

    // Recalibrate from all feedback
    const handleRecalibrate = useCallback(async () => {
        setRecalibrating(true);
        const allFeedback = await loadAllFeedback();
        setFeedbackCount(allFeedback.length);
        const synthesized = synthesizeCalibrationPrompt(allFeedback);
        setPromptText(synthesized);
        setRecalibrating(false);
    }, []);

    // Save profile
    const handleSave = useCallback(async () => {
        setSaving(true);
        const updatedProfile: CalibrationProfile = {
            displayName: 'Admin',
            totalReviews: feedbackCount,
            lastCalibrated: new Date().toISOString(),
            calibrationPrompt: promptText,
            enabled,
        };
        await saveCalibrationProfile(updatedProfile);
        setProfile(updatedProfile);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }, [promptText, enabled, feedbackCount]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin text-2xl">⏳</div>
                <span className="ml-3 text-black-400">Loading calibration data...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-display text-gold-200 flex items-center gap-3">
                    <span className="text-3xl">🧠</span>
                    Calibration Profile
                </h2>
                <p className="text-black-400 mt-1">
                    Train the AI to match your taste. Your feedback on screenplay analyses is synthesized into
                    calibration instructions that are injected into every future analysis prompt.
                </p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-black-800/50 border border-gold-500/10 text-center">
                    <p className="text-3xl font-display font-bold text-gold-400">{feedbackCount}</p>
                    <p className="text-xs text-black-500 mt-1">Reviews Given</p>
                </div>
                <div className="p-4 rounded-xl bg-black-800/50 border border-gold-500/10 text-center">
                    <p className="text-3xl font-display font-bold text-gold-400">
                        {feedbackCount < 5 ? 'Low' : feedbackCount < 20 ? 'Medium' : 'High'}
                    </p>
                    <p className="text-xs text-black-500 mt-1">Confidence</p>
                </div>
                <div className="p-4 rounded-xl bg-black-800/50 border border-gold-500/10 text-center">
                    <p className="text-3xl font-display font-bold text-gold-400">
                        {profile?.lastCalibrated
                            ? new Date(profile.lastCalibrated).toLocaleDateString()
                            : 'Never'}
                    </p>
                    <p className="text-xs text-black-500 mt-1">Last Calibrated</p>
                </div>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-black-800/50 border border-gold-500/10">
                <div>
                    <p className="text-gold-200 font-medium">Use Calibration Profile</p>
                    <p className="text-xs text-black-500 mt-0.5">
                        When enabled, the calibration prompt below is injected into every new analysis.
                    </p>
                </div>
                <button
                    onClick={() => setEnabled(!enabled)}
                    className={clsx(
                        'relative w-12 h-6 rounded-full transition-all',
                        enabled ? 'bg-gold-500' : 'bg-black-700',
                    )}
                >
                    <div
                        className={clsx(
                            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                            enabled ? 'translate-x-6' : 'translate-x-0.5',
                        )}
                    />
                </button>
            </div>

            {feedbackCount === 0 && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                    ⚠️ No feedback yet. Open any screenplay card → <strong>Producer Feedback</strong> section
                    to start training the AI. After reviewing a few scripts, come back and hit "Recalibrate."
                </div>
            )}

            {/* Recalibrate Button */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleRecalibrate}
                    disabled={recalibrating || feedbackCount === 0}
                    className={clsx(
                        'px-5 py-2.5 rounded-lg font-medium text-sm transition-all',
                        recalibrating || feedbackCount === 0
                            ? 'bg-black-700 text-black-500 cursor-not-allowed'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30',
                    )}
                >
                    {recalibrating ? '⏳ Recalibrating...' : '🔄 Recalibrate from Feedback'}
                </button>
                <p className="text-xs text-black-600">
                    Re-synthesizes the prompt below from all your {feedbackCount} review(s)
                </p>
            </div>

            {/* Editable Calibration Prompt */}
            <div>
                <label className="text-xs text-black-500 uppercase tracking-wider mb-2 block">
                    Calibration Prompt
                    <span className="text-black-600 ml-2">
                        (you can edit this directly — it's injected verbatim into analysis prompts)
                    </span>
                </label>
                <textarea
                    className="input w-full font-mono text-sm resize-y"
                    rows={16}
                    placeholder="No calibration data yet. Give feedback on screenplay analyses to generate calibration instructions..."
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                />
                <p className="text-xs text-black-600 mt-1">
                    {promptText.length} characters • Max ~4000 recommended to avoid prompt bloat
                </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={clsx(
                        'px-8 py-3 rounded-xl font-display text-sm transition-all',
                        saved
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-gradient-to-r from-gold-500/80 to-amber-500/80 text-black-900 hover:from-gold-400 hover:to-amber-400 shadow-lg shadow-gold-500/20',
                    )}
                >
                    {saving ? 'Saving...' : saved ? '✓ Profile Saved' : 'Save Profile'}
                </button>
            </div>
        </div>
    );
}

export default CalibrationPanel;
