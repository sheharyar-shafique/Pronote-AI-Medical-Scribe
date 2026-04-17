import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Bell, 
  Shield, 
  CreditCard, 
  FileText,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  ExternalLink
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Card, Button, Input, Toggle, Select, Modal } from '../components/ui';
import { useAuthStore, useSettingsStore } from '../store';
import { templates, specialties, pricingPlans } from '../data';
import { subscriptionsApi, authApi, usersApi } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const { 
    selectedTemplate, 
    setTemplate, 
    autoSave, 
    notifications, 
    weeklySummary,
    noteReminders,
    productUpdates,
    toggleAutoSave, 
    toggleNotifications,
    toggleWeeklySummary,
    toggleNoteReminders,
    toggleProductUpdates
  } = useSettingsStore();
  
  const [activeTab, setActiveTab] = useState('general');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    specialty: user?.specialty || 'General Medicine',
  });

  const tabs = [
    { id: 'general', label: 'General', icon: <User size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'templates', label: 'Templates', icon: <FileText size={18} /> },
    { id: 'security', label: 'Account & Security', icon: <Shield size={18} /> },
  ];

  const handleProfileSave = () => {
    updateUser({
      name: profileForm.name,
      specialty: profileForm.specialty,
    });
    toast.success('Profile updated successfully');
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleToggle2FA = () => {
    if (twoFactorEnabled) {
      setTwoFactorEnabled(false);
      toast.success('Two-factor authentication disabled');
    } else {
      setTwoFactorEnabled(true);
      toast.success('Two-factor authentication enabled');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setIsDeletingAccount(true);
    try {
      await usersApi.deleteAccount();
      toast.success('Account deleted successfully');
      logout();
      navigate('/');
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to delete account');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(true);
    try {
      const response = await subscriptionsApi.createCheckout(
        planId,
        `${window.location.origin}/settings?success=true`,
        `${window.location.origin}/settings?canceled=true`
      );
      
      if (response.url) {
        window.location.href = response.url;
      } else {
        toast.error('Could not create checkout session');
      }
    } catch (error) {
      const err = error as { message?: string; status?: number };
      if (err.status === 503) {
        toast.error('Payment processing is not configured. Please contact support.');
      } else {
        toast.error(err.message || 'Failed to start checkout');
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <Sidebar>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">
            Manage your account settings and preferences.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-64 flex-shrink-0"
          >
            <Card className="p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                    activeTab === tab.id
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.icon}
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </Card>

            {/* Subscription Card */}
            <Card className="p-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Current Plan</span>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  {user?.subscriptionPlan || 'Trial'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                {user?.subscriptionStatus === 'trial' 
                  ? 'Your trial ends in 14 days'
                  : `${user?.subscriptionPlan} plan`
                }
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => setShowUpgradeModal(true)}
              >
                <CreditCard size={16} className="mr-2" />
                Upgrade Plan
              </Button>
            </Card>
          </motion.div>

          {/* Content Area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1"
          >
            {activeTab === 'general' && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">General Settings</h2>
                
                <div className="space-y-6">
                  <Input
                    label="Full Name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  />
                  
                  <Input
                    label="Email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    disabled
                    helperText="Email cannot be changed"
                  />
                  
                  <Select
                    label="Specialty"
                    value={profileForm.specialty}
                    onChange={(e) => setProfileForm({ ...profileForm, specialty: e.target.value })}
                    options={specialties.map(s => ({ value: s, label: s }))}
                  />

                  <div className="pt-4 border-t border-gray-200">
                    <Button onClick={handleProfileSave}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Notification Settings</h2>
                
                <div className="space-y-6">
                  <Toggle
                    enabled={notifications}
                    onChange={toggleNotifications}
                    label="Push Notifications"
                    description="Receive notifications about your notes and account"
                  />
                  
                  <Toggle
                    enabled={autoSave}
                    onChange={toggleAutoSave}
                    label="Auto-Save"
                    description="Automatically save notes while editing"
                  />

                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="font-medium text-gray-900 mb-4">Email Notifications</h3>
                    <div className="space-y-4">
                      <Toggle
                        enabled={weeklySummary}
                        onChange={toggleWeeklySummary}
                        label="Weekly Summary"
                        description="Receive a weekly summary of your activity"
                      />
                      <Toggle
                        enabled={noteReminders}
                        onChange={toggleNoteReminders}
                        label="Note Reminders"
                        description="Get reminded about unsigned notes"
                      />
                      <Toggle
                        enabled={productUpdates}
                        onChange={toggleProductUpdates}
                        label="Product Updates"
                        description="Learn about new features and improvements"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'templates' && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Template Settings</h2>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Template
                  </label>
                  <Select
                    value={selectedTemplate}
                    onChange={(e) => {
                      const templateId = e.target.value as import('../types').NoteTemplate;
                      setTemplate(templateId);
                    }}
                    options={templates.map(t => ({ value: t.id, label: t.name }))}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    This template will be used by default when creating new notes.
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-4">Available Templates</h3>
                  <div className="grid gap-3">
                    {templates.map((template) => (
                      <motion.div
                        key={template.id}
                        whileHover={{ scale: 1.01 }}
                        className={`p-4 border rounded-xl cursor-pointer transition-all ${
                          selectedTemplate === template.id
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setTemplate(template.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{template.name}</h4>
                            <p className="text-sm text-gray-500">{template.description}</p>
                          </div>
                          {selectedTemplate === template.id && (
                            <Check size={20} className="text-emerald-500" />
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'security' && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Account & Security</h2>
                
                <div className="space-y-6">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Change Password</h4>
                        <p className="text-sm text-gray-500">Update your password regularly for security</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setShowPasswordModal(true)}>
                        <Lock size={14} className="mr-1" />
                        Change
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Two-Factor Authentication</h4>
                        <p className="text-sm text-gray-500">
                          {twoFactorEnabled 
                            ? '2FA is enabled for your account' 
                            : 'Add an extra layer of security'}
                        </p>
                      </div>
                      <Button 
                        variant={twoFactorEnabled ? "primary" : "outline"} 
                        size="sm"
                        onClick={handleToggle2FA}
                        className={twoFactorEnabled ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                      >
                        {twoFactorEnabled ? 'Enabled' : 'Enable'}
                      </Button>
                    </div>
                  </div>

                  <div 
                    className="p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setShowPrivacyModal(true)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Privacy Policy</h4>
                        <p className="text-sm text-gray-500">View our privacy policy</p>
                      </div>
                      <ExternalLink size={18} className="text-gray-400" />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="font-medium text-gray-900 mb-4">Danger Zone</h3>
                    <div className="p-4 border border-red-200 rounded-xl bg-red-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-red-700">Delete Account</h4>
                          <p className="text-sm text-red-600">Permanently delete your account and all data</p>
                        </div>
                        <Button 
                          className="bg-red-500 hover:bg-red-600" 
                          size="sm"
                          onClick={() => setShowDeleteModal(true)}
                        >
                          <Trash2 size={14} className="mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </motion.div>
        </div>

        {/* Upgrade Modal */}
        <Modal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          title="Upgrade Your Plan"
          size="full"
        >
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Payment processing requires Stripe configuration. Contact support to enable subscriptions.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pricingPlans.map((plan) => (
              <div
                key={plan.id}
                className={`p-5 border-2 rounded-xl flex flex-col h-full ${
                  plan.highlighted ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div>
                  <h4 className="font-semibold text-gray-900 text-lg">{plan.name}</h4>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {plan.price ? `$${plan.price}` : 'Custom'}
                    {plan.price && <span className="text-sm font-normal text-gray-500">/{plan.period}</span>}
                  </p>
                  {plan.pricePerMonth && plan.period === 'year' && (
                    <p className="text-sm text-emerald-600 font-medium">${plan.pricePerMonth.toFixed(2)}/mo</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                </div>
                <ul className="space-y-2 mt-4 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  variant={plan.highlighted ? 'primary' : 'outline'}
                  className="w-full mt-5"
                  disabled={isUpgrading}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {isUpgrading ? 'Processing...' : plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </Modal>

        {/* Change Password Modal */}
        <Modal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setShowPasswords({ current: false, new: false, confirm: false });
          }}
          title="Change Password"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <div className="relative">
                <Input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <Input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Account Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteConfirmText('');
          }}
          title="Delete Account"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> This action cannot be undone. All your data, including notes, 
                templates, and account information will be permanently deleted.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE</span> to confirm:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="font-mono"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-red-500 hover:bg-red-600"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || deleteConfirmText !== 'DELETE'}
              >
                <Trash2 size={14} className="mr-1" />
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Privacy Policy Modal */}
        <Modal
          isOpen={showPrivacyModal}
          onClose={() => setShowPrivacyModal(false)}
          title="Privacy Policy"
          size="lg"
        >
          <div className="prose prose-sm max-w-none text-gray-600">
            <h3 className="text-lg font-semibold text-gray-900">1. Information We Collect</h3>
            <p>
              We collect information you provide directly to us, such as when you create an account, 
              use our services, or contact us for support. This includes:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information (name, email, password)</li>
              <li>Clinical notes and documentation you create</li>
              <li>Audio recordings for dictation features</li>
              <li>Usage data and preferences</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-4">2. How We Use Your Information</h3>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide, maintain, and improve our services</li>
              <li>Process your clinical documentation</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-4">3. Data Security</h3>
            <p>
              We take reasonable measures to protect your personal information. All data is encrypted 
              in transit and at rest. We comply with HIPAA requirements for handling healthcare information.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-4">4. Data Retention</h3>
            <p>
              We retain your data for as long as your account is active or as needed to provide services. 
              You can request deletion of your data at any time through the account settings.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-4">5. Contact Us</h3>
            <p>
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:privacy@pronote.com" className="text-emerald-600 hover:text-emerald-700">
                privacy@pronote.com
              </a>
            </p>
          </div>
          <div className="flex justify-end pt-6">
            <Button onClick={() => setShowPrivacyModal(false)}>
              Close
            </Button>
          </div>
        </Modal>
      </div>
    </Sidebar>
  );
}
