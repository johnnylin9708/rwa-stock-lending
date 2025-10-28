"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWeb3 } from "@/context/web3-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface KYCFormData {
  // Personal Information
  givenName: string;
  familyName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  taxId: string;
  
  // Address
  address: {
    streetAddress: string;
    unit?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  
  // Additional Information
  citizenship: string;
  fundingSource: string[];
  employmentStatus: string;
  annualIncome: string;
  netWorth: string;
  liquidNetWorth: string;
  
  // Investment Experience
  investmentExperience: string;
  investmentObjective: string;
  riskTolerance: string;
  
  // Trusted Contact
  trustedContact: {
    givenName: string;
    familyName: string;
    emailAddress?: string;
    phoneNumber?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export default function SignUpPage() {
  const router = useRouter();
  const { address, isAuthenticated, sessionToken,user, authenticateWallet, isLoading } = useWeb3();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<KYCFormData>({
    givenName: "",
    familyName: "",
    email: "",
    phoneNumber: "1234567890",
    dateOfBirth: "01/01/1990",
    taxId: "666-55-4321",
    address: {
      streetAddress: "123 Main St",
      unit: "3F-1",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "TWN",
    },
    citizenship: "TWN",
    fundingSource: ["employment_income"],
    employmentStatus: "employed",
    annualIncome: "",
    netWorth: "",
    liquidNetWorth: "",
    investmentExperience: "limited",
    investmentObjective: "growth",
    riskTolerance: "moderate",
    trustedContact: {
      givenName: "John",
      familyName: "Doe",
      emailAddress: "jane.doe@example.com",
      phoneNumber: "",
      streetAddress: "",
      city: "",
      state: "",
      postalCode: "",
      country: "TWN",
    },
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [autoConnectTriggered, setAutoConnectTriggered] = useState(false);

  // 自动连接钱包和认证
  useEffect(() => {
    if (!autoConnectTriggered && !isAuthenticated && !isLoading) {
      setAutoConnectTriggered(true);
      authenticateWallet();
    }
  }, [autoConnectTriggered, isAuthenticated, isLoading, authenticateWallet]);

  // 检查用户是否已经有 Alpaca 账户
  useEffect(() => {
    if (user?.hasAlpacaAccount) {
      router.push("/");
    }
  }, [user, router]);

  const handleChange = (field: string, value: any) => {
    if (field.startsWith("address.")) {
      const addressField = field.split(".")[1];
      setFormData({
        ...formData,
        address: { ...formData.address, [addressField]: value },
      });
    } else if (field.startsWith("trustedContact.")) {
      const contactField = field.split(".")[1];
      setFormData({
        ...formData,
        trustedContact: { ...formData.trustedContact, [contactField]: value },
      });
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const validateStep1 = () => {
    if (!formData.givenName || !formData.familyName || !formData.email) {
      setError("Please fill in all required fields");
      return false;
    }
    if (!formData.phoneNumber || !formData.dateOfBirth || !formData.taxId) {
      setError("Please fill in all required fields");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.address.streetAddress || !formData.address.city || 
        !formData.address.postalCode) {
      setError("Please fill in complete address information");
      return false;
    }
    // state field is optional, not enforced
    return true;
  };

  const validateStep5 = () => {
    // Trusted contact requires given name and family name
    if (!formData.trustedContact.givenName || !formData.trustedContact.familyName) {
      setError("Please provide trusted contact's first and last name");
      return false;
    }
    
    // At least one of email, phone, or street address is required
    const hasEmail = formData.trustedContact.emailAddress && formData.trustedContact.emailAddress.trim() !== "";
    const hasPhone = formData.trustedContact.phoneNumber && formData.trustedContact.phoneNumber.trim() !== "";
    const hasAddress = formData.trustedContact.streetAddress && formData.trustedContact.streetAddress.trim() !== "";
    
    if (!hasEmail && !hasPhone && !hasAddress) {
      setError("Please provide at least one contact method (email, phone, or address)");
      return false;
    }
    
    // If address is provided, city, state, postal code, and country are required
    if (hasAddress) {
      if (!formData.trustedContact.city || !formData.trustedContact.state || 
          !formData.trustedContact.postalCode || !formData.trustedContact.country) {
        setError("If address is provided, city, state, postal code, and country are required");
        return false;
      }
    }
    
    return true;
  };

  const handleNext = () => {
    setError("");
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 5 && !validateStep5()) return;
    setStep(step + 1);
  };

  const handlePrevious = () => {
    setError("");
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!isAuthenticated || !address) {
      setError("Please connect and authenticate your wallet first");
      return;
    }

    // Validate step 5 before submitting
    if (!validateStep5()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // 调用注册 API，创建用户和 Alpaca 账户
      const response = await fetch("/api/user/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: address,
          email: formData.email,
          createAlpacaAccount: true,
          kycData: {
            givenName: formData.givenName,
            familyName: formData.familyName,
            dateOfBirth: formData.dateOfBirth,
            taxId: formData.taxId,
            phoneNumber: formData.phoneNumber,
            address: {
              streetAddress: [formData.address.streetAddress, formData.address.unit].filter(Boolean),
              city: formData.address.city,
              state: formData.address.state,
              postalCode: formData.address.postalCode,
              country: formData.address.country,
            },
            citizenship: formData.citizenship,
            fundingSource: formData.fundingSource,
            employmentStatus: formData.employmentStatus,
            annualIncome: formData.annualIncome,
            netWorth: formData.netWorth,
            liquidNetWorth: formData.liquidNetWorth,
            investmentExperience: formData.investmentExperience,
            investmentObjective: formData.investmentObjective,
            riskTolerance: formData.riskTolerance,
            trustedContact: {
              givenName: formData.trustedContact.givenName,
              familyName: formData.trustedContact.familyName,
              emailAddress: formData.trustedContact.emailAddress,
              phoneNumber: formData.trustedContact.phoneNumber,
              streetAddress: formData.trustedContact.streetAddress,
              city: formData.trustedContact.city,
              state: formData.trustedContact.state,
              postalCode: formData.trustedContact.postalCode,
              country: formData.trustedContact.country,
            },
          },
        }),
      });

      const result = await response.json();

      if (response.ok || response.status === 409) {
        setSuccess("KYC submitted successfully! Creating and verifying on-chain identity...");
        
        // Step 2: Automatically create ERC-3643 Identity (with auto-verification)
        try {
          const identityResponse = await fetch("/api/erc3643/identity/create", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          });
          
          const identityResult = await identityResponse.json();
          
          if (identityResponse.ok && identityResult.isRegistered) {
            setSuccess(
              `Registration successful!\n✓ KYC approved\n✓ On-chain identity created: ${identityResult.identityAddress?.slice(0, 10)}...\n✓ KYC Claim issued\n✓ Registered to IdentityRegistry\n\nYou can now use ERC-3643 tokens!`
            );
            setTimeout(() => {
              router.push("/");
            }, 1000);
          } else if (identityResponse.ok) {
            // Identity created but not fully registered
            setSuccess(
              `Registration successful!\n✓ KYC submitted\n✓ On-chain identity created: ${identityResult.identityAddress?.slice(0, 10)}...\n\nPlease refresh to complete verification.`
            );
            setTimeout(() => {
              router.push("/");
            }, 1000);
          } else {
            // KYC succeeded but Identity creation failed, still considered successful, can be created later
            setSuccess(
              result.message || "Registration successful! KYC submitted.\n" + 
              "(On-chain identity will be created automatically on first login)"
            );
            setTimeout(() => {
              router.push("/");
            }, 1000);
          }
        } catch (identityError) {
          console.error("Identity creation failed:", identityError);
          // KYC succeeded but Identity creation failed, still considered successful
          setSuccess(result.message || "Registration successful! KYC submitted.");
          setTimeout(() => {
            router.push("/");
          }, 1000);
        }
      } else {
        setError(result.error || "Registration failed, please try again");
      }
    } catch (err: any) {
      setError(err.message || "Submission failed, please check your network connection");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Web3 认证
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Welcome to RWA Stock Lending Platform</CardTitle>
            <CardDescription>
              First, please connect and authenticate your Web3 wallet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!address ? (
              <Button 
                onClick={authenticateWallet} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Connecting..." : "Connect Wallet"}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">
                    ✓ Wallet Connected: {address.slice(0, 6)}...{address.slice(-4)}
                  </p>
                </div>
                <Button 
                  onClick={authenticateWallet} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? "Authenticating..." : "Sign to Authenticate"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-4xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Open Trading Account - KYC Information</CardTitle>
            <CardDescription>
              Partnered with Alpaca Securities for compliant brokerage services
            </CardDescription>
            {/* Progress Steps */}
            <div className="flex items-center justify-center mt-4 space-x-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step >= s
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {s}
                  </div>
                  {s < 5 && (
                    <div
                      className={`w-12 h-1 ${
                        step > s ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-2">
              <p className="text-sm text-gray-600">
                {step === 1 && "Personal Information"}
                {step === 2 && "Address Information"}
                {step === 3 && "Financial Information"}
                {step === 4 && "Investment Experience"}
                {step === 5 && "Trusted Contact"}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Personal Information */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="givenName">First Name *</Label>
                      <Input
                        id="givenName"
                        value={formData.givenName}
                        onChange={(e) => handleChange("givenName", e.target.value)}
                        placeholder="John"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="familyName">Last Name *</Label>
                      <Input
                        id="familyName"
                        value={formData.familyName}
                        onChange={(e) => handleChange("familyName", e.target.value)}
                        placeholder="Doe"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="john.doe@example.com"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phoneNumber">Phone Number *</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => handleChange("phoneNumber", e.target.value)}
                        placeholder="+886912345678"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Include country code, e.g.: Taiwan +886, China +86
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxId">
                        {formData.citizenship === 'USA' ? 'Tax ID (SSN/ITIN)' : 'Passport Number'} *
                      </Label>
                      <Input
                        id="taxId"
                        value={formData.taxId}
                        onChange={(e) => handleChange("taxId", e.target.value)}
                        placeholder={formData.citizenship === 'USA' ? 'XXX-XX-XXXX' : 'A12345678'}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.citizenship === 'USA' 
                          ? 'US citizens provide SSN or ITIN' 
                          : 'Non-US citizens provide passport number'}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="citizenship">Citizenship *</Label>
                      <select
                        id="citizenship"
                        value={formData.citizenship}
                        onChange={(e) => handleChange("citizenship", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        <option value="TWN">Taiwan (台湾)</option>
                        <option value="CHN">China (中国)</option>
                        <option value="USA">United States (美国)</option>
                        <option value="JPN">Japan (日本)</option>
                        <option value="KOR">South Korea (韩国)</option>
                        <option value="SGP">Singapore (新加坡)</option>
                        <option value="HKG">Hong Kong (香港)</option>
                        <option value="OTHER">Other (其他)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Address */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Address Information</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="streetAddress">Street Address *</Label>
                      <Input
                          id="streetAddress"
                          value={formData.address.streetAddress}
                          onChange={(e) => handleChange("address.streetAddress", e.target.value)}
                          placeholder="No. 7, Sec. 5, Xinyi Rd., Xinyi Dist., Taipei City"
                          required
                      />
                    </div>
                    <div>
                      <Label htmlFor="unit">Unit/Apartment Number</Label>
                      <Input
                          id="unit"
                          value={formData.address.unit}
                          onChange={(e) => handleChange("address.unit", e.target.value)}
                          placeholder="3F-1 or Apt 4B"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={formData.address.city}
                          onChange={(e) => handleChange("address.city", e.target.value)}
                          placeholder="Taipei"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">State/Province (Optional)</Label>
                        <Input
                          id="state"
                          value={formData.address.state}
                          onChange={(e) => handleChange("address.state", e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="postalCode">Postal Code *</Label>
                        <Input
                          id="postalCode"
                          value={formData.address.postalCode}
                          onChange={(e) => handleChange("address.postalCode", e.target.value)}
                          placeholder="100"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="country">Country *</Label>
                        <select
                          id="country"
                          value={formData.address.country}
                          onChange={(e) => handleChange("address.country", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        >
                          <option value="TWN">Taiwan (台湾)</option>
                          <option value="CHN">China (中国)</option>
                          <option value="USA">United States (美国)</option>
                          <option value="JPN">Japan (日本)</option>
                          <option value="KOR">South Korea (韩国)</option>
                          <option value="SGP">Singapore (新加坡)</option>
                          <option value="HKG">Hong Kong (香港)</option>
                          <option value="OTHER">Other (其他)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Financial Information */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Financial Information</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="employmentStatus">Employment Status *</Label>
                      <select
                        id="employmentStatus"
                        value={formData.employmentStatus}
                        onChange={(e) => handleChange("employmentStatus", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        <option value="employed">Employed</option>
                        <option value="self_employed">Self-Employed</option>
                        <option value="unemployed">Unemployed</option>
                        <option value="retired">Retired</option>
                        <option value="student">Student</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="annualIncome">Annual Income (USD) *</Label>
                      <select
                        id="annualIncome"
                        value={formData.annualIncome}
                        onChange={(e) => handleChange("annualIncome", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        <option value="">Please Select</option>
                        <option value="0-25000">$0 - $25,000</option>
                        <option value="25000-50000">$25,000 - $50,000</option>
                        <option value="50000-100000">$50,000 - $100,000</option>
                        <option value="100000-200000">$100,000 - $200,000</option>
                        <option value="200000+">$200,000+</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="netWorth">Net Worth (USD) *</Label>
                      <select
                        id="netWorth"
                        value={formData.netWorth}
                        onChange={(e) => handleChange("netWorth", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        <option value="">Please Select</option>
                        <option value="0-50000">$0 - $50,000</option>
                        <option value="50000-100000">$50,000 - $100,000</option>
                        <option value="100000-500000">$100,000 - $500,000</option>
                        <option value="500000-1000000">$500,000 - $1,000,000</option>
                        <option value="1000000+">$1,000,000+</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="liquidNetWorth">Liquid Net Worth (USD) *</Label>
                      <select
                        id="liquidNetWorth"
                        value={formData.liquidNetWorth}
                        onChange={(e) => handleChange("liquidNetWorth", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        <option value="">Please Select</option>
                        <option value="0-25000">$0 - $25,000</option>
                        <option value="25000-50000">$25,000 - $50,000</option>
                        <option value="50000-100000">$50,000 - $100,000</option>
                        <option value="100000-250000">$100,000 - $250,000</option>
                        <option value="250000+">$250,000+</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Investment Experience */}
              {step === 4 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Investment Experience</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="investmentExperience">Investment Experience *</Label>
                      <select
                        id="investmentExperience"
                        value={formData.investmentExperience}
                        onChange={(e) => handleChange("investmentExperience", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        <option value="none">No Experience</option>
                        <option value="limited">Limited Experience (&lt; 1 year)</option>
                        <option value="good">Good Experience (1-5 years)</option>
                        <option value="extensive">Extensive Experience (5+ years)</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="investmentObjective">Investment Objective *</Label>
                      <select
                        id="investmentObjective"
                        value={formData.investmentObjective}
                        onChange={(e) => handleChange("investmentObjective", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        <option value="capital_preservation">Capital Preservation</option>
                        <option value="income">Income</option>
                        <option value="growth">Growth</option>
                        <option value="speculation">Speculation</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="riskTolerance">Risk Tolerance *</Label>
                      <select
                        id="riskTolerance"
                        value={formData.riskTolerance}
                        onChange={(e) => handleChange("riskTolerance", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        conservative, moderate, significant_risk
                        <option value="conservative">Conservative</option>
                        <option value="moderate">Moderate</option>
                        <option value="significant_risk">Significant Risk</option>
                      </select>
                    </div>
                  </div>

                </div>
              )}

              {/* Step 5: Trusted Contact */}
              {step === 5 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Trusted Contact Information</h3>
                  <p className="text-sm text-gray-600">
                    Please provide a trusted contact person. This is for emergency purposes and account security.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="trustedGivenName">First Name *</Label>
                      <Input
                        id="trustedGivenName"
                        value={formData.trustedContact.givenName}
                        onChange={(e) => handleChange("trustedContact.givenName", e.target.value)}
                        placeholder="John"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="trustedFamilyName">Last Name *</Label>
                      <Input
                        id="trustedFamilyName"
                        value={formData.trustedContact.familyName}
                        onChange={(e) => handleChange("trustedContact.familyName", e.target.value)}
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700 font-medium mb-2">
                      Contact Information (At least one required) *
                    </p>
                    <p className="text-xs text-blue-600">
                      Please provide at least one method to contact this person: email, phone, or physical address.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="trustedEmail">Email Address</Label>
                      <Input
                        id="trustedEmail"
                        type="email"
                        value={formData.trustedContact.emailAddress}
                        onChange={(e) => handleChange("trustedContact.emailAddress", e.target.value)}
                        placeholder="john.doe@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="trustedPhone">Phone Number</Label>
                      <Input
                        id="trustedPhone"
                        type="tel"
                        value={formData.trustedContact.phoneNumber}
                        onChange={(e) => handleChange("trustedContact.phoneNumber", e.target.value)}
                        placeholder="+886912345678"
                      />
                    </div>
                  </div>
                  {/* Disclosures */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg space-y-3">
                            <h4 className="font-semibold">Compliance Statements</h4>
                            <div className="space-y-2 text-sm">
                            <label className="flex items-start space-x-2">
                                <input type="checkbox" required className="mt-1" />
                                <span>I confirm that I am not affiliated with FINRA or a stock exchange</span>
                            </label>
                            <label className="flex items-start space-x-2">
                                <input type="checkbox" required className="mt-1" />
                                <span>I confirm that I am not a control person of a publicly traded company</span>
                            </label>
                            <label className="flex items-start space-x-2">
                                <input type="checkbox" required className="mt-1" />
                                <span>I confirm that I am not a Politically Exposed Person (PEP)</span>
                            </label>
                            </div>
                        </div>

                        {/* Agreements */}
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                            <label className="flex items-start space-x-2">
                            <input type="checkbox" required className="mt-1" />
                            <span className="text-sm">
                                I have read and agree to the <button type="button" className="text-blue-600 underline">Customer Agreement</button>,{' '}
                                <button type="button" className="text-blue-600 underline">Margin Agreement</button>, and{' '}
                                <button type="button" className="text-blue-600 underline">Account Agreement</button>
                            </span>
                            </label>
                        </div>
                </div>
              )}

              {/* Error/Success Messages */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  onClick={handlePrevious}
                  disabled={step === 1 || isSubmitting}
                  variant="outline"
                >
                  Previous
                </Button>
                {step < 5 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={isSubmitting}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isSubmitting ? "Submitting..." : "Submit & Create Account"}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

