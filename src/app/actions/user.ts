'use server';

import { createBrokerageAccount } from "@/lib/alpaca-client";
import { isValidAddress } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db/mongodb";
import type { UserSchema } from "@/lib/db/schemas";

export const getUser = async (walletAddress: string) => {
    const db = await getDatabase();
    const usersCollection = db.collection<UserSchema>('users');
    
    const user = await usersCollection.findOne({ 
      walletAddress 
    });

    if (!user) {
      return null
    }
    
    const { kycData, ...safeUser } = user;
    
    return {
        ...safeUser,
        _id: user._id?.toString(), // Convert ObjectId to string
        kycStatus: user.kycStatus,
        hasKYC: !!kycData,
        hasAlpacaAccount: !!user.alpacaAccount,
        alpacaAccountStatus: user.alpacaAccount?.status,
    }
}

export const registerUser = async (walletAddress: string, email: string, kycData: any) => {
  if (!walletAddress || !isValidAddress(walletAddress)) {
    throw new Error("Invalid wallet address")
  }
  
  if (!email || !email.includes('@')) {
    throw new Error("Invalid email")
  }
  
  const db = await getDatabase();
  const usersCollection = db.collection<UserSchema>('users');
  
  const normalizedAddress = walletAddress.toLowerCase();
  
  const existingUser = await usersCollection.findOne({ 
    walletAddress: normalizedAddress 
  });
  
  if (existingUser && existingUser.email && existingUser.kycStatus !== 'not_started') {
    throw new Error("User already registered")
  }
  
  // Validate KYC data if provided
  if (kycData) {
    const requiredFields = ['givenName', 'familyName', 'dateOfBirth', 'phoneNumber', 'address'];
    const missingFields = requiredFields.filter(field => !kycData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing KYC fields: ${missingFields.join(', ')}`)
    }
    
    // Validate address structure
    if (!kycData.address.streetAddress || !kycData.address.city || 
        !kycData.address.state || !kycData.address.postalCode || 
        !kycData.address.country) {
      throw new Error("Complete address information is required")
    }
  }
  
  const userData: UserSchema = {
    walletAddress: normalizedAddress,
    email,
    kycStatus: kycData ? 'pending' : 'not_started',
    kycData: kycData ? {
      fullName: `${kycData.givenName} ${kycData.familyName}`,
      givenName: kycData.givenName,
      familyName: kycData.familyName,
      dateOfBirth: kycData.dateOfBirth,
      taxId: kycData.taxId,
      country: kycData.address.country,
      phoneNumber: kycData.phoneNumber,
      address: kycData.address,
      submittedAt: new Date()
    } : undefined,
    bankAccounts: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Create Alpaca brokerage account if requested and KYC data is provided
  if (kycData) {
    try {
      const alpacaAccount = await createBrokerageAccount({
        email,
        givenName: kycData.givenName,
        familyName: kycData.familyName,
        dateOfBirth: kycData.dateOfBirth,
        taxId: kycData.taxId,
        phoneNumber: kycData.phoneNumber,
        streetAddress: Array.isArray(kycData.address.streetAddress) 
          ? kycData.address.streetAddress 
          : [kycData.address.streetAddress],
        city: kycData.address.city,
        state: kycData.address.state,
        postalCode: kycData.address.postalCode,
        country: kycData.address.country,
        citizenship: kycData.citizenship,
        fundingSource: kycData.fundingSource || ['employment_income'],
        // Financial information
        employmentStatus: kycData.employmentStatus,
        annualIncome: kycData.annualIncome,
        netWorth: kycData.netWorth,
        liquidNetWorth: kycData.liquidNetWorth,
        // Investment profile
        investmentExperience: kycData.investmentExperience,
        investmentObjective: kycData.investmentObjective,
        riskTolerance: kycData.riskTolerance,
        // Trusted contact
        trustedContact: kycData.trustedContact ? {
          givenName: kycData.trustedContact.givenName,
          familyName: kycData.trustedContact.familyName,
          emailAddress: kycData.trustedContact.emailAddress,
          phoneNumber: kycData.trustedContact.phoneNumber,
          streetAddress: kycData.trustedContact.streetAddress,
          city: kycData.trustedContact.city,
          state: kycData.trustedContact.state,
          postalCode: kycData.trustedContact.postalCode,
          country: kycData.trustedContact.country,
        } : undefined,
      });
      
      // Add Alpaca account info to user data
      userData.alpacaAccount = {
        accountId: alpacaAccount.id,
        accountNumber: alpacaAccount.account_number,
        status: alpacaAccount.status,
        accountType: 'trading',
        createdAt: new Date(),
        currency: 'USD',
      };
      
      userData.kycStatus = 'approved'; // Alpaca will handle KYC approval
      
    } catch (alpacaError: any) {
      console.error("Failed to create Alpaca account:", alpacaError);
      // Continue with user registration even if Alpaca account creation fails
      // User can retry later
      throw new Error(alpacaError.response?.data?.message || alpacaError.message || "Failed to create Alpaca account")
      
    }
  }

  let result;
    if (existingUser) {
      // Update existing user
      await usersCollection.updateOne(
        { walletAddress: normalizedAddress },
        { $set: userData }
      );
      result = { insertedId: existingUser._id };
    } else {
      // Create new user
      result = await usersCollection.insertOne(userData as any);
    }
  
  return {
    success: true,
    userId: result.insertedId,
    alpacaAccountId: userData.alpacaAccount?.accountId,
    alpacaAccountStatus: userData.alpacaAccount?.status,
  }
}