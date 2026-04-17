import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Lock, 
  CreditCard, 
  AlertTriangle,
  ArrowRight,
  Mail,
  Phone
} from 'lucide-react';
import { Button } from '../components/ui';
import { useAuthStore } from '../store';

export default function SubscriptionLockedPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full"
      >
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Lock size={40} className="text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-2">Account Locked</h1>
            <p className="text-white/80">
              Your subscription has expired or payment failed
            </p>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-amber-800">Action Required</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Your access to Pronote has been temporarily suspended. Please update your payment method to continue using all features.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                  <CreditCard size={20} className="text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Update Payment Method</p>
                  <p className="text-sm text-gray-500">Add a valid credit card to restore access</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Mail size={20} className="text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Check Your Email</p>
                  <p className="text-sm text-gray-500">We've sent payment instructions to {user?.email || 'your email'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                className="w-full" 
                onClick={() => window.open('https://billing.stripe.com', '_blank')}
              >
                <CreditCard size={18} className="mr-2" />
                Update Payment Method
                <ArrowRight size={18} className="ml-2" />
              </Button>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/pricing')}
              >
                View Plans & Pricing
              </Button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-center text-sm text-gray-500 mb-4">
                Need help? Contact our support team
              </p>
              <div className="flex items-center justify-center gap-4">
                <a 
                  href="mailto:support@pronote.ai" 
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors"
                >
                  <Mail size={16} />
                  support@pronote.ai
                </a>
                <span className="text-gray-300">|</span>
                <a 
                  href="tel:+18001234567" 
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors"
                >
                  <Phone size={16} />
                  1-800-123-4567
                </a>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Sign out and use a different account
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
