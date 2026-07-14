# Requirements Document

## 1. Application Overview

**Application Name:** Nigeria WiFi Billing & Hotspot Management System

**Description:** A web-based WiFi billing and hotspot management platform designed for Nigeria. Users can purchase WiFi packages via Paystack payment gateway or redeem voucher codes to access internet. Administrators can manage users, generate vouchers, view revenue analytics, and configure system settings. The system integrates with MikroTik routers for MAC address whitelisting and access control.

---

## 2. Users and Usage Scenarios

**Target Users:**
- End Users: Individuals purchasing WiFi access via packages or vouchers
- Administrators: System operators managing users, payments, vouchers, and system configuration
- Resellers: Third parties purchasing vouchers in bulk at discounted prices for resale

**Core Usage Scenarios:**
- User purchases a WiFi package, pays via Paystack, and gains internet access
- User redeems a voucher code on hotspot login page to get access
- Admin generates vouchers (single or bulk) and distributes to resellers or end users
- Admin monitors revenue, transactions, and system performance via analytics dashboard
- Admin manages user accounts, payment records, and system settings

---

## 3. Page Structure and Functional Description

### Page Hierarchy

```
├── Home/User Portal
├── Packages
├── Voucher Redemption
├── Support
├── Admin Login
└── Admin Area
    ├── Dashboard (Analytics)
    ├── Users Management
    ├── Payments/Transactions
    ├── Voucher Management
    └── System Settings
```

### 3.1 Home/User Portal

**Purpose:** Allow users to select WiFi packages, pay via Paystack, or redeem vouchers.

**Functions:**
- Display available WiFi packages with prices in Nigerian Naira (₦/NGN)
- User selects a package and proceeds to payment
- Payment via Paystack: support card, bank transfer, USSD
- After successful payment, user's MAC address is whitelisted on MikroTik router for internet access
- Provide voucher redemption entry point (link to Voucher Redemption page)

### 3.2 Packages

**Purpose:** Browse all available WiFi packages.

**Functions:**
- Display package list with name, price (NGN), validity period, data limit
- User can select a package and proceed to payment on User Portal

### 3.3 Voucher Redemption

**Purpose:** Allow users to redeem voucher codes for internet access.

**Functions:**
- User enters voucher code (alphanumeric PIN)
- System validates voucher: check if code exists, not used, not expired
- If valid, user's MAC address is whitelisted and voucher status changes to Used
- Display access confirmation and validity period

### 3.4 Support

**Purpose:** Provide user support information.

**Functions:**
- Display contact information (phone number in Nigerian format: 080/081/090/070, 11 digits)
- FAQ or help documentation

### 3.5 Admin Login

**Purpose:** Authenticate administrators.

**Functions:**
- Admin enters username and password
- Successful login redirects to Admin Dashboard

### 3.6 Admin Dashboard (Analytics)

**Purpose:** Provide revenue and system performance overview.

**Functions:**
- Display key metrics: Total Revenue, Total Transactions, Active Users, Active Sessions
- Revenue charts: daily/weekly/monthly bar chart and line chart
- Payment method breakdown: Paystack card, bank transfer, USSD, voucher
- Top packages by popularity (ranked list)
- Recent transactions table with columns: Date, User, Amount (NGN), Payment Method, Status
- Search transactions by user or date range
- Export transactions to CSV
- Revenue trend comparison vs previous period (percentage change)

### 3.7 Admin: Users Management

**Purpose:** Manage user accounts and access.

**Functions:**
- Display user list with columns: Name, Phone Number (Nigerian format), MAC Address, Package, Status, Expiry Date
- Search users by name or phone number
- View user details: payment history, active sessions
- Manually whitelist or blacklist user MAC address

### 3.8 Admin: Payments/Transactions

**Purpose:** View and manage payment records.

**Functions:**
- Display transaction list with columns: Transaction ID, Date, User, Amount (NGN), Payment Method, Status
- Filter by date range, payment method, status
- Export transactions to CSV
- View transaction details: Paystack reference, user info, package purchased

### 3.9 Admin: Voucher Management

**Purpose:** Generate, view, and manage vouchers.

**Functions:**
- Generate vouchers: single or bulk (specify quantity)
- Configure voucher parameters: validity period (1hr, 4hr, 12hr, 24hr), data limit, price (NGN), reseller discount price
- Voucher code format: random alphanumeric (e.g., 8-12 characters)
- Display voucher list with columns: Code, Status (Active, Used, Expired), Validity, Data Limit, Price, Created Date, Used Date
- Filter vouchers by status
- Export vouchers to PDF or CSV (for printing or distribution)
- View voucher usage details: user who redeemed, redemption date

### 3.10 Admin: System Settings

**Purpose:** Configure system parameters.

**Functions:**
- Configure Paystack API keys (public key, secret key)
- Configure MikroTik router connection (IP address, username, password)
- Set default package prices and validity periods
- Manage admin accounts (add, edit, delete)

---

## 4. Business Rules and Logic

### 4.1 Payment Processing

- User selects package and initiates payment via Paystack
- System calls Paystack API (via Supabase Edge Function) to initialize transaction
- User completes payment using card, bank transfer, or USSD
- Paystack webhook notifies system of payment status
- On successful payment, system records transaction in Supabase database and whitelists user MAC address on MikroTik router

### 4.2 MAC Address Whitelisting

- After successful payment or voucher redemption, system retrieves user's MAC address
- System connects to MikroTik router and adds MAC address to whitelist
- User gains internet access for the duration specified in package or voucher
- When validity period expires, MAC address is removed from whitelist

### 4.3 Voucher Lifecycle

- Admin generates voucher with validity period and data limit
- Voucher status is Active upon creation
- User redeems voucher by entering code on Voucher Redemption page
- System validates code: must exist, status must be Active, not expired
- On successful redemption, voucher status changes to Used, user MAC address is whitelisted
- If voucher validity period expires before redemption, status changes to Expired

### 4.4 Revenue Calculation

- Total Revenue = sum of all successful Paystack transactions + sum of all redeemed vouchers (at voucher price, not reseller discount price)
- Revenue charts aggregate data by day/week/month based on transaction date
- Payment method breakdown counts transactions by Paystack card, bank transfer, USSD, and voucher redemption

### 4.5 Reseller Discount

- Admin can set a reseller discount price when generating vouchers
- Resellers purchase vouchers at discount price
- Revenue calculation uses voucher face value (not reseller price) when voucher is redeemed by end user

---

## 5. Exceptions and Boundary Cases

| Scenario | Handling |
|----------|----------|
| Payment fails or is cancelled | Transaction status marked as Failed, no MAC whitelisting, user notified |
| Voucher code invalid or already used | Display error message, do not grant access |
| Voucher expired | Display error message, voucher status remains Expired |
| User MAC address not detected | Prompt user to connect to WiFi network first |
| MikroTik router connection fails | Log error, notify admin, retry connection |
| Paystack webhook not received | System polls Paystack API to verify transaction status |
| User tries to redeem voucher after expiry | Display error message, voucher cannot be redeemed |
| Admin generates vouchers with invalid parameters | Display validation error, prevent generation |
| Duplicate voucher code generated | Regenerate code until unique |
| User phone number format incorrect | Validate Nigerian phone number format (11 digits, starts with 080/081/090/070) |

---

## 6. Acceptance Criteria

1. User visits Home/User Portal, selects a WiFi package priced in NGN
2. User completes payment via Paystack (card, bank transfer, or USSD)
3. System receives payment confirmation and whitelists user MAC address on MikroTik router
4. User gains internet access for the package validity period
5. Admin logs into Admin Dashboard and views revenue analytics (charts, metrics, recent transactions)
6. Admin navigates to Voucher Management, generates 10 vouchers with 24hr validity and 5GB data limit
7. Admin exports vouchers to PDF for distribution
8. End user redeems voucher code on Voucher Redemption page and gains internet access

---

## 7. Out of Scope for This Release

- Multi-language support (only English in this release)
- SMS notifications for payment confirmation or voucher delivery
- Mobile app (iOS/Android)
- Integration with payment gateways other than Paystack
- Automated voucher expiry reminders
- User self-service account management (password reset, profile editing)
- Advanced analytics (user behavior tracking, heatmaps, A/B testing)
- Reseller portal (separate interface for resellers to purchase and manage vouchers)
- API for third-party integrations
- Multi-tenancy (support for multiple WiFi networks or locations)
- Customizable branding (logo, colors, themes)
- Automated refunds or payment disputes handling
- Integration with accounting software
- Real-time session monitoring (bandwidth usage, active connections)
- Voucher QR code generation
- Email notifications