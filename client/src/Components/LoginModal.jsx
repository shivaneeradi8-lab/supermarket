import React from "react";
import { useNavigate } from "react-router-dom";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { useAppContext } from "../context/AppContext";
import { saveToken } from "../lib/api";
import { auth, isFirebaseConfigured } from "../lib/firebase";

const LoginModal = () => {
  const navigate = useNavigate();
  const { setShowLoginModal, setUser, setIsSeller } = useAppContext();
  const [phone, setPhone] = React.useState("+91");
  const [otp, setOtp] = React.useState("");
  const [step, setStep] = React.useState("phone");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const confirmationResultRef = React.useRef(null);

  const normalizePhone = (value) => String(value || "").replace(/[^\d+]/g, "");
  const isValidE164Phone = (value) => /^\+[1-9]\d{7,14}$/.test(value);
  const handlePhoneChange = (event) => {
    const nextValue = normalizePhone(event.target.value);
    if (!nextValue || nextValue === "+") {
      setPhone("+91");
      return;
    }

    if (!nextValue.startsWith("+91")) {
      const digitsOnly = nextValue.replace(/^\+/, "").replace(/^91/, "");
      setPhone(`+91${digitsOnly}`);
      return;
    }

    setPhone(nextValue);
  };

  const getFirebaseErrorMessage = (code) => {
    switch (code) {
      case "auth/invalid-phone-number":
        return "Invalid phone format. Use country code, for example +91xxxxxxxxxx.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      case "auth/invalid-verification-code":
        return "Incorrect OTP. Please try again.";
      case "auth/code-expired":
        return "OTP expired. Please request a new OTP.";
      default:
        return "Authentication failed. Please try again.";
    }
  };

  const ensureRecaptcha = React.useCallback(() => {
    if (window.recaptchaVerifier) return window.recaptchaVerifier;

    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: () => {
        // Triggered after successful reCAPTCHA challenge.
      },
    });

    return window.recaptchaVerifier;
  }, []);

  React.useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  const requestOtp = async (e) => {
    if (e) e.preventDefault();
    if (!phone) return;

    const formattedPhone = normalizePhone(phone);

    if (!isFirebaseConfigured) {
      setError("Phone login is unavailable until Firebase Phone Authentication is configured.");
      return;
    }

    if (!isValidE164Phone(formattedPhone)) {
      setError("Please enter phone in international format, e.g. +918790041756");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const verifier = ensureRecaptcha();
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      confirmationResultRef.current = confirmationResult;
      setPhone(formattedPhone);
      setStep("otp");
      setMessage("OTP sent successfully.");
    } catch (err) {
      setError(getFirebaseErrorMessage(err?.code));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    if (!phone || !otp) return;

    if (!isFirebaseConfigured) {
      setError("Phone login is unavailable until Firebase Phone Authentication is configured.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (!confirmationResultRef.current) {
        setError("Please request OTP first.");
        setLoading(false);
        return;
      }

      const userCredential = await confirmationResultRef.current.confirm(otp.trim());
      const firebaseUser = userCredential.user;
      const token = await firebaseUser.getIdToken();

      saveToken(token);

      const nextUser = {
        name: firebaseUser.displayName || "GreenCart User",
        email: firebaseUser.email || "",
        role: "customer",
        phone: firebaseUser.phoneNumber || phone,
      };

      localStorage.setItem("greencart_user", JSON.stringify(nextUser));
      setUser(nextUser);
      setIsSeller(false);
      setShowLoginModal(false);
      navigate("/");
    } catch (err) {
      setError(getFirebaseErrorMessage(err?.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px] flex items-center justify-center px-4"
      onClick={() => setShowLoginModal(false)}
    >
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close login modal"
          onClick={() => setShowLoginModal(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
        >
          ×
        </button>

        <h2 className="text-4xl font-semibold text-center text-gray-800 mb-8">
          <span className="text-primary">Phone</span> Login
        </h2>

        {!isFirebaseConfigured && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Firebase Phone Authentication is not configured. Phone login is disabled until real Firebase credentials are added.
          </div>
        )}

        <form onSubmit={step === "phone" ? requestOtp : verifyOtp} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-600 mb-2">Phone Number</label>
            <input
              name="phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="+91 9876543210"
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:border-primary"
              disabled={step === "otp"}
            />
          </div>

          {step === "otp" && (
            <div>
              <label className="block text-sm text-gray-600 mb-2">OTP Code</label>
              <input
                name="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit OTP"
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:border-primary tracking-[0.35em]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isFirebaseConfigured}
            className="w-full bg-primary hover:bg-primary-dull transition text-white font-medium py-2.5 rounded-md disabled:opacity-60"
          >
            {loading ? "Please wait..." : step === "phone" ? "Send OTP" : "Verify OTP"}
          </button>

          {step === "otp" && (
            <button
              type="button"
              onClick={() => requestOtp()}
              disabled={loading || !isFirebaseConfigured}
              className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-md hover:bg-gray-50 transition"
            >
              Resend OTP
            </button>
          )}

          {message && (
            <p className="text-sm text-emerald-600 text-center">{message}</p>
          )}

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
        </form>

        <div id="recaptcha-container" />
      </div>
    </div>
  );
};

export default LoginModal;
