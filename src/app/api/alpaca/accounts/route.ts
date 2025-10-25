import { NextResponse } from "next/server";
import Alpaca from "@alpacahq/alpaca-trade-api";

export async function POST(request: Request) {
    const alpaca = new Alpaca({
        keyId: process.env.ALPACA_API_KEY_ID,
        secretKey: process.env.ALPACA_SECRET_KEY,
        paper: true,
    });

    try {
        const body = await request.json();

        // This is a simplified example.
        // A real application would need to collect much more information
        // to satisfy Alpaca's KYC requirements.
        const accountData = {
            contact: {
                email_address: body.email_address,
                phone_number: '555-555-5555', // Placeholder
                street_address: [body.street_address],
                city: body.city,
                state: body.state,
                postal_code: body.postal_code,
                country: body.country,
            },
            identity: {
                given_name: body.given_name,
                family_name: body.family_name,
                date_of_birth: '1990-01-01', // Placeholder
                tax_id: '123-456-7890', // Placeholder
                tax_id_type: 'USA_SSN', // Placeholder
                country_of_citizenship: 'USA',
                country_of_birth: 'USA',
                country_of_tax_residence: 'USA',
            },
            disclosures: {
                is_control_person: false,
                is_affiliated_exchange_or_finra: false,
                is_politically_exposed: false,
                immediate_family_exposed: false,
            },
            agreements: [
                {
                    agreement: 'margin_agreement',
                    signed_at: new Date().toISOString(),
                    ip_address: '127.0.0.1', // Placeholder
                },
                {
                    agreement: 'account_agreement',
                    signed_at: new Date().toISOString(),
                    ip_address: '127.0.0.1', // Placeholder
                },
                {
                    agreement: 'customer_agreement',
                    signed_at: new Date().toISOString(),
                    ip_address: '127.0.0.1', // Placeholder
                },
            ],
            // This would need to be a real funding source
            // trusted_contact: ...
        };

        const account = await alpaca.createAccount(accountData);

        return NextResponse.json(account);
    } catch (error: any) {
        console.error(error);
        const errorMessage = error.response?.data?.message || "Failed to create account";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
