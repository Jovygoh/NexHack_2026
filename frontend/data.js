// ═══════════════════════════════════════════
// CONTRACT DATA — real text from the 5 PDFs
// ═══════════════════════════════════════════
const CONFIG = {
  API_URL: "http://127.0.0.1:8000"
};
const CONTRACTS = [
  {
    id: 1,
    filename: 'Contract_1_Employment_NovaTech.pdf',
    company: 'NovaTech Solutions Sdn. Bhd.',
    date: '12 Jun 2026', time: '09:42 AM',
    status: 'critical',
    title: 'EMPLOYMENT CONTRACT',
    subtitle: 'Permanent Full-Time Position',
    meta: ['Between: NovaTech Solutions Sdn. Bhd. (Co. No. 202301012345)', 'And: Ahmad Faris bin Zulkifli (NRIC: 950312-14-5678)', 'Date: 1 June 2026'],
    sig: ['NovaTech Solutions Sdn. Bhd.', 'Ahmad Faris bin Zulkifli'],
    sections: [
      { title: '1. POSITION AND DUTIES', clauses: [
        { id:'1.1', text:'The Employee is appointed as Senior Software Engineer at NovaTech Solutions Sdn. Bhd., reporting directly to the Head of Engineering.', status:'ok' },
        { id:'1.2', text:'The Employee shall perform all duties as assigned by the Employer and such other duties as may be required from time to time.', status:'ok' },
        { id:'1.3', text:'The Employee agrees to devote their full working time and attention to the business of the Employer.', status:'ok' },
      ]},
      { title: '2. REMUNERATION', clauses: [
        { id:'2.1', text:'The Employee shall be paid a monthly gross salary of RM 5,500, payable on the last working day of each calendar month.', status:'ok' },
        { id:'2.2', text:'The Employer reserves the right to revise the salary at any time without prior notice to the Employee.', status:'warn', issue:'Unilateral salary revision', law:'Employment Act 1955 s.10', desc:'Employers cannot unilaterally reduce salary without employee consent under s.10 of the Employment Act.', suggestion:'Replace with: "Any revision to the Employee\'s salary shall be made only with mutual written agreement between both parties."' },
        { id:'2.3', text:'All overtime work performed by the Employee shall be compensated at the Employee\'s standard hourly rate with no additional premium.', status:'bad', issue:'No overtime premium', law:'Employment Act 1955 s.60A', desc:'Overtime must be paid at 1.5× the hourly rate under s.60A. "Standard rate with no premium" is non-compliant.', suggestion:'Replace with: "Overtime shall be compensated at one and a half (1.5) times the Employee\'s hourly rate in accordance with Section 60A of the Employment Act 1955."' },
      ]},
      { title: '3. WORKING HOURS', clauses: [
        { id:'3.1', text:'The Employee shall work a minimum of 52 hours per week, Monday to Saturday, inclusive of a one-hour lunch break each day.', status:'bad', issue:'Exceeds maximum working hours', law:'Employment Act 1955 s.60A', desc:'Maximum working hours are 48 per week under s.60A. 52 hours is non-compliant.', suggestion:'Replace with: "The Employee shall work no more than 48 hours per week in accordance with Section 60A of the Employment Act 1955."' },
        { id:'3.2', text:'The Employee may be required to work on public holidays without additional compensation.', status:'bad', issue:'No public holiday pay', law:'Employment Act 1955 s.60D', desc:'Employees working on public holidays must receive double pay under s.60D of the Employment Act.', suggestion:'Replace with: "The Employee required to work on a public holiday shall be paid at twice the ordinary rate of pay in accordance with Section 60D of the Employment Act 1955."' },
      ]},
      { title: '4. LEAVE ENTITLEMENT', clauses: [
        { id:'4.1', text:'The Employee shall be entitled to 5 days of annual leave per year regardless of length of service.', status:'bad', issue:'Insufficient annual leave', law:'Employment Act 1955 s.60E', desc:'Minimum annual leave is 8 days (<2 yrs service), 12 days (2–5 yrs), 16 days (>5 yrs) under s.60E.', suggestion:'Replace with: "Annual leave shall be granted in accordance with Section 60E of the Employment Act 1955: 8 days for less than 2 years, 12 days for 2–5 years, and 16 days for more than 5 years of service."' },
        { id:'4.2', text:'Sick leave entitlement shall be 5 days per year, subject to production of a medical certificate.', status:'bad', issue:'Insufficient sick leave', law:'Employment Act 1955 s.60F', desc:'Minimum sick leave is 14 days per year without hospitalisation under s.60F.', suggestion:'Replace with: "Sick leave shall be 14 days per year (without hospitalisation) or 60 days (with hospitalisation) per year in accordance with Section 60F of the Employment Act 1955."' },
        { id:'4.3', text:'Unused leave shall be forfeited at the end of each calendar year and shall not be carried forward or encashed.', status:'warn', issue:'Leave forfeiture may be void', law:'Employment Act 1955', desc:'Forfeiture of statutory minimum leave entitlement may be unenforceable. Parties should specify carry-forward terms clearly.', suggestion:'Add: "Notwithstanding the above, statutory minimum leave entitlements shall not be forfeited to the extent required by law."' },
      ]},
      { title: '5. TERMINATION', clauses: [
        { id:'5.1', text:'Either party may terminate this Agreement by providing 24 hours written notice to the other party.', status:'bad', issue:'Inadequate termination notice', law:'Employment Act 1955 s.12', desc:'Minimum notice is 4 weeks for employees with 2+ years service under s.12. 24 hours is non-compliant.', suggestion:'Replace with: "Either party may terminate this Agreement by providing not less than four (4) weeks written notice, or payment in lieu thereof, in accordance with Section 12 of the Employment Act 1955."' },
        { id:'5.2', text:'The Employer may terminate the Employee\'s services immediately and without notice or compensation for any reason deemed sufficient by the Employer.', status:'bad', issue:'Arbitrary termination without due process', law:'Employment Act 1955 s.13/14', desc:'Immediate termination without cause or due inquiry violates ss.13–14. Grounds must be proven and inquiry conducted.', suggestion:'Replace with: "The Employer may terminate for misconduct only after conducting a due domestic inquiry in accordance with Sections 13–14 of the Employment Act 1955."' },
      ]},
      { title: '6. PERSONAL DATA', clauses: [
        { id:'6.1', text:'The Employee consents to the Employer collecting, processing, and disclosing their personal data to any third party including marketing partners, recruitment agencies, and government bodies, for any purpose the Employer deems necessary.', status:'bad', issue:'Overbroad data consent — PDPA violation', law:'PDPA 2010 s.6', desc:'Under PDPA 2010, personal data may only be processed for the specific purpose disclosed at the time of collection. Blanket third-party sharing for any purpose is non-compliant.', suggestion:'Replace with: "Personal data shall be collected and processed only for purposes directly related to employment and disclosed to third parties only with specific consent and in compliance with the Personal Data Protection Act 2010."' },
        { id:'6.2', text:'The Employee waives all rights under the Personal Data Protection Act 2010 with respect to data held by the Employer.', status:'bad', issue:'PDPA rights cannot be waived', law:'PDPA 2010 s.30–38', desc:'Statutory rights under PDPA (access, correction, withdrawal of consent) cannot be contracted away. This clause is void ab initio.', suggestion:'Remove this clause entirely. PDPA rights are non-waivable by law.' },
      ]},
      { title: '7. GOVERNING LAW', clauses: [
        { id:'7.1', text:'This Agreement shall be governed by and construed in accordance with the laws of Malaysia.', status:'ok' },
        { id:'7.2', text:'Any dispute arising under this Agreement shall be resolved by arbitration in Kuala Lumpur.', status:'ok' },
      ]},
    ]
  },
  {
    id: 2,
    filename: 'Contract_2_NDA_PrimeVentures.pdf',
    company: 'Prime Ventures Capital Bhd.',
    date: '11 Jun 2026', time: '02:15 PM',
    status: 'issues',
    title: 'NON-DISCLOSURE AGREEMENT',
    subtitle: 'Mutual Confidentiality Agreement',
    meta: ['Between: Prime Ventures Capital Bhd. (Co. No. 201901087654)', 'And: Siti Nabilah binti Razali (NRIC: 880924-07-3456)', 'Date: 5 June 2026'],
    sig: ['Prime Ventures Capital Bhd.', 'Siti Nabilah binti Razali'],
    sections: [
      { title: '1. DEFINITION OF CONFIDENTIAL INFORMATION', clauses: [
        { id:'1.1', text:"'Confidential Information' means absolutely all information, in any form whatsoever, disclosed by either party to the other, including but not limited to information that is publicly available, general knowledge, or information independently developed by the Receiving Party.", status:'bad', issue:'Overbroad definition — includes public info', law:'Contract law / reasonableness', desc:'Including publicly available information or independently developed information in the definition of Confidential Information is unenforceable. Courts will strike this down as unreasonable.', suggestion:'Replace with: "Confidential Information means non-public information disclosed by one party to the other that is marked confidential or ought reasonably to be understood as confidential, excluding information already in the public domain."' },
        { id:'1.2', text:'The Receiving Party agrees that all ideas, concepts, or thoughts developed during or after the term of this Agreement may constitute Confidential Information.', status:'warn', issue:'Overbroad scope — post-term ideas', law:'Contract law', desc:'Claiming ownership over ideas developed after the agreement ends is unreasonably broad and likely unenforceable.', suggestion:'Limit to: "Ideas directly derived from Confidential Information disclosed during the term of this Agreement."' },
      ]},
      { title: '2. OBLIGATIONS', clauses: [
        { id:'2.1', text:'The Receiving Party shall not disclose, copy, or use the Confidential Information for any purpose whatsoever, including for their own independent business operations unrelated to this Agreement.', status:'warn', issue:'Restricts independent business operations', law:'Contract law / restraint of trade', desc:'Preventing a party from using their own independent knowledge unrelated to the agreement may constitute an unlawful restraint of trade.', suggestion:'Add carve-out: "except where the information was independently developed without reference to the Confidential Information disclosed hereunder."' },
        { id:'2.2', text:'The Receiving Party shall take all possible measures to protect the Confidential Information, including measures beyond those used for their own information.', status:'ok' },
      ]},
      { title: '3. DURATION', clauses: [
        { id:'3.1', text:'The obligations under this Agreement shall remain in force permanently and indefinitely, without any expiry date.', status:'bad', issue:'Indefinite duration — unenforceable', law:'Malaysian contract law', desc:'Malaysian courts typically limit NDA enforceability to 2–5 years. An indefinite NDA is likely to be struck down as an unreasonable restraint.', suggestion:'Replace with: "The obligations under this Agreement shall remain in force for a period of three (3) years from the date of disclosure of the Confidential Information."' },
        { id:'3.2', text:'Even after any business relationship between the parties has ceased, all obligations remain permanently binding.', status:'bad', issue:'Post-relationship permanent obligation', law:'Contract law', desc:'Permanent post-termination obligations are unreasonably broad and will likely be unenforceable.', suggestion:'Replace with: "Obligations shall survive termination for the period specified in Clause 3.1 above."' },
      ]},
      { title: '4. NO CARVE-OUTS', clauses: [
        { id:'4.1', text:'The Receiving Party agrees that no exception shall apply to the confidentiality obligations herein, including where disclosure is required by law, court order, or regulatory authority.', status:'bad', issue:'Cannot prohibit legally required disclosure', law:'Evidence Act / court orders', desc:'A contractual clause cannot override a legal obligation to disclose information to courts or regulators. This clause is void and potentially in contempt of court.', suggestion:'Replace with: "The Receiving Party may disclose Confidential Information to the extent required by applicable law or court order, provided it gives prompt written notice to the Disclosing Party before such disclosure."' },
      ]},
      { title: '5. REMEDY', clauses: [
        { id:'5.1', text:'In the event of any breach, the Disclosing Party shall be entitled to claim damages of no less than RM 5,000,000 as liquidated damages, regardless of actual loss suffered.', status:'warn', issue:'Disproportionate penalty clause', law:'Contracts Act 1950 s.75', desc:'Under s.75 of the Contracts Act 1950, courts may only award reasonable compensation. A penalty disproportionate to actual loss may be reduced or voided.', suggestion:'Replace with: "The parties agree that a reasonable pre-estimate of damages for breach is RM [amount], which the parties agree is a genuine pre-estimate and not a penalty."' },
      ]},
      { title: '6. GOVERNING LAW', clauses: [
        { id:'6.1', text:'This Agreement is governed by the laws of Malaysia.', status:'ok' },
        { id:'6.2', text:'Disputes shall be submitted to the Kuala Lumpur High Court.', status:'ok' },
      ]},
    ]
  },
  {
    id: 3,
    filename: 'Contract_3_Vendor_LogiPrime.pdf',
    company: 'LogiPrime Distribution Bhd.',
    date: '10 Jun 2026', time: '11:08 AM',
    status: 'critical',
    title: 'VENDOR SERVICE AGREEMENT',
    subtitle: 'IT Infrastructure Maintenance Services',
    meta: ['Between: LogiPrime Distribution Bhd. (Co. No. 201501056789)', 'And: ByteCore Systems Sdn. Bhd. (Co. No. 202001034567)', 'Date: 3 June 2026'],
    sig: ['LogiPrime Distribution Bhd.', 'ByteCore Systems Sdn. Bhd.'],
    sections: [
      { title: '1. SERVICES', clauses: [
        { id:'1.1', text:"ByteCore Systems ('Vendor') agrees to provide IT infrastructure maintenance, server management, and cybersecurity monitoring services to LogiPrime Distribution ('Client').", status:'ok' },
        { id:'1.2', text:'The scope of services may be expanded or reduced by the Client at any time without renegotiation of fees.', status:'warn', issue:'Unilateral scope change without fee adjustment', law:'Contract law / consideration', desc:'Expanding scope without corresponding fee adjustment undermines the bargain. May be unenforceable as lacking consideration for the additional work.', suggestion:'Add: "Any expansion of scope shall be agreed in writing with corresponding fee adjustment before work commences."' },
      ]},
      { title: '2. PAYMENT TERMS', clauses: [
        { id:'2.1', text:'The Client shall pay the Vendor a monthly retainer of RM 18,000.', status:'ok' },
        { id:'2.2', text:'All invoices shall be settled within 120 days from the date of invoice submission.', status:'bad', issue:'Excessive payment term — 120 days', law:'Commercial practice / good faith', desc:'120-day payment terms are excessively long and may constitute an unfair commercial practice, particularly against SME vendors.', suggestion:'Replace with: "All invoices shall be settled within thirty (30) days from the date of invoice submission."' },
        { id:'2.3', text:"The Client reserves the right to withhold payment indefinitely if any aspect of the service is deemed unsatisfactory, at the Client's sole discretion.", status:'bad', issue:'Indefinite payment withholding', law:'Contracts Act 1950', desc:'Unilateral, indefinite withholding of payment based on subjective satisfaction is unconscionable and unenforceable.', suggestion:'Replace with: "The Client may withhold disputed amounts pending resolution, but must pay undisputed amounts within the agreed payment period."' },
        { id:'2.4', text:'No interest shall accrue on overdue payments regardless of the delay period.', status:'warn', issue:'Waiver of interest on overdue payments', law:'Contracts Act 1950', desc:'While parties may agree to waive interest, this clause combined with the 120-day term creates unreasonable cash flow burden on the Vendor.', suggestion:'Add: "Interest at the rate of 1% per month shall apply to payments outstanding beyond 60 days."' },
      ]},
      { title: '3. LIABILITY', clauses: [
        { id:'3.1', text:'The Vendor shall be fully liable for all direct, indirect, incidental, consequential, and punitive damages arising from any breach or service failure, without any financial cap or limitation whatsoever.', status:'bad', issue:'Unlimited liability — commercially unreasonable', law:'Contract law', desc:'Unlimited liability without any cap is commercially unreasonable and courts may intervene. Industry standard is to cap liability at the value of the contract.', suggestion:'Replace with: "The Vendor\'s total aggregate liability shall not exceed the total fees paid in the 12 months preceding the claim."' },
        { id:'3.2', text:"The Client shall bear no liability whatsoever for any loss suffered by the Vendor, including losses arising from the Client's own negligence.", status:'bad', issue:'Client exempted from own negligence', law:'Contract law / Unfair Contract Terms', desc:"A party cannot entirely exempt itself from liability for its own negligence. This clause is likely void under common law principles.", suggestion:'Remove or replace with: "Neither party excludes liability for death, personal injury, or losses arising from its own gross negligence or wilful misconduct."' },
      ]},
      { title: '4. DATA ACCESS AND PROCESSING', clauses: [
        { id:'4.1', text:'The Vendor is granted unrestricted access to all Client data, customer records, and financial information for the purpose of service delivery.', status:'warn', issue:'Unrestricted data access — PDPA risk', law:'PDPA 2010', desc:'Granting unrestricted access to personal data without limiting it to what is necessary for the service may breach the data minimisation principle under PDPA 2010.', suggestion:'Replace with: "The Vendor shall have access only to data strictly necessary for service delivery and shall implement appropriate safeguards in accordance with PDPA 2010."' },
        { id:'4.2', text:"The Vendor may retain, copy, and utilise all Client data for its own business development and research purposes following termination of this Agreement.", status:'bad', issue:'Post-termination data retention — PDPA violation', law:'PDPA 2010 s.10', desc:'Retaining and using client personal data for own purposes after contract termination violates PDPA 2010. Data must be deleted or returned upon termination.', suggestion:'Replace with: "Upon termination, the Vendor shall return or securely destroy all Client data within 30 days and certify such destruction in writing."' },
        { id:'4.3', text:"No data processing agreement or data protection obligations shall apply to the Vendor's handling of personal data encountered during service delivery.", status:'bad', issue:'No data processing agreement — PDPA violation', law:'PDPA 2010', desc:'Where a vendor processes personal data on behalf of a client, a data processing agreement is required under PDPA 2010. This clause attempts to exclude such obligations entirely.', suggestion:'Replace with: "The parties shall execute a data processing agreement in accordance with PDPA 2010 prior to commencement of services."' },
      ]},
      { title: '5. TERMINATION', clauses: [
        { id:'5.1', text:'The Client may terminate this Agreement at any time without notice and without payment of any compensation to the Vendor.', status:'bad', issue:'No termination notice — unfair', law:'Contract law', desc:'Allowing termination without any notice denies the Vendor reasonable opportunity to wind down operations. A minimum notice period is standard commercial practice.', suggestion:'Replace with: "Either party may terminate this Agreement by providing 30 days written notice to the other party."' },
        { id:'5.2', text:'The Vendor may not terminate this Agreement regardless of non-payment by the Client.', status:'bad', issue:'Vendor cannot exit despite non-payment', law:'Contracts Act 1950 s.40', desc:'Preventing a party from terminating despite material breach (non-payment) is contrary to s.40 of the Contracts Act 1950 and is unenforceable.', suggestion:'Replace with: "Either party may terminate for material breach upon 14 days written notice if the breach is not remedied within that period."' },
      ]},
      { title: '6. GOVERNING LAW', clauses: [
        { id:'6.1', text:'This Agreement shall be governed by Malaysian law.', status:'ok' },
      ]},
    ]
  },
  {
    id: 4,
    filename: 'Contract_4_Freelance_CreativeHub.pdf',
    company: 'CreativeHub Malaysia Sdn. Bhd.',
    date: '8 Jun 2026', time: '03:55 PM',
    status: 'issues',
    title: 'FREELANCE SERVICES AGREEMENT',
    subtitle: 'Graphic Design and Creative Services',
    meta: ['Between: CreativeHub Malaysia Sdn. Bhd. (Co. No. 202201023456)', 'And: Lim Wei Xian (NRIC: 991105-10-7890)', 'Date: 7 June 2026'],
    sig: ['CreativeHub Malaysia Sdn. Bhd.', 'Lim Wei Xian'],
    sections: [
      { title: '1. SERVICES', clauses: [
        { id:'1.1', text:'The Freelancer agrees to provide graphic design, branding, and digital illustration services as directed by CreativeHub Malaysia from time to time.', status:'ok' },
        { id:'1.2', text:"The Freelancer shall be available for work at any time, including weekends and public holidays, upon 2 hours' notice from the Client.", status:'warn', issue:'Unreasonable availability requirement', law:'Contract law / employment status', desc:'Requiring 24/7 availability with 2-hour notice may reclassify the freelancer as an employee, creating employment law obligations for the Client.', suggestion:'Replace with: "The Freelancer shall use reasonable efforts to accommodate project requests with reasonable advance notice mutually agreed between the parties."' },
      ]},
      { title: '2. FEES AND PAYMENT', clauses: [
        { id:'2.1', text:'The Freelancer shall be paid at a rate of RM 80 per hour for services rendered.', status:'ok' },
        { id:'2.2', text:"Invoices shall be paid at the Client's discretion, with no fixed payment timeline or deadline.", status:'bad', issue:'No fixed payment timeline', law:'Contracts Act 1950 — certainty of terms', desc:'A contract with no payment deadline is legally uncertain and effectively allows the Client to withhold payment indefinitely. Courts may imply a reasonable time.', suggestion:'Replace with: "Invoices shall be paid within 30 days of submission. Overdue payments shall accrue interest at 1% per month."' },
        { id:'2.3', text:'The Client reserves the right to reduce the agreed rate at any time without prior consent from the Freelancer.', status:'bad', issue:'Unilateral rate reduction', law:'Contract law / consideration', desc:'Unilaterally reducing an agreed rate without consent lacks consideration and is not binding on the Freelancer.', suggestion:'Replace with: "Any changes to the agreed hourly rate shall be mutually agreed in writing at least 30 days before taking effect."' },
      ]},
      { title: '3. INTELLECTUAL PROPERTY', clauses: [
        { id:'3.1', text:'All work, concepts, sketches, drafts, and final deliverables created by the Freelancer — including personal projects developed outside the scope of this Agreement — shall become the sole and exclusive property of CreativeHub Malaysia.', status:'bad', issue:'Captures personal IP outside scope', law:'Copyright Act 1987', desc:'Claiming IP over work created outside the scope of engagement is overbroad, likely unenforceable, and may violate the Copyright Act 1987.', suggestion:'Replace with: "IP in all deliverables created specifically for the Client within the scope of this Agreement shall vest in the Client upon full payment."' },
        { id:'3.2', text:'The Freelancer waives all moral rights in all works created, in perpetuity and throughout the universe.', status:'warn', issue:'Broad moral rights waiver', law:'Copyright Act 1987', desc:'While moral rights waivers are permissible, a waiver "throughout the universe" is legally meaningless and may invite scrutiny of the entire clause.', suggestion:'Replace with: "The Freelancer waives moral rights in deliverables created under this Agreement to the extent permitted by Malaysian law."' },
        { id:'3.3', text:'The Freelancer shall not retain any copy, portfolio sample, or reference to work completed under this Agreement.', status:'warn', issue:'No portfolio use — overly restrictive', law:'Industry practice / contract reasonableness', desc:'Preventing a freelancer from using work as a portfolio reference is unusually restrictive and may deter talent. Courts may view this as unreasonable.', suggestion:'Replace with: "The Freelancer may display completed work in their portfolio unless the Client designates specific projects as confidential in writing."' },
      ]},
      { title: '4. NON-COMPETE', clauses: [
        { id:'4.1', text:'The Freelancer agrees not to provide any design, creative, or digital services to any individual, company, or organisation in Malaysia or globally, during the term of this Agreement and for a period of 5 years thereafter.', status:'bad', issue:'5-year global non-compete — unenforceable', law:'Contracts Act 1950 s.28', desc:'Under s.28 of the Contracts Act 1950, agreements restraining trade are void unless reasonable. A 5-year global ban on all creative work for a freelancer is clearly unreasonable.', suggestion:'Replace with: "The Freelancer shall not provide substantially similar services to the Client\'s direct competitors in Malaysia for a period of 6 months after this Agreement ends."' },
        { id:'4.2', text:'Breach of this clause shall result in a penalty of RM 500,000 payable immediately to the Client.', status:'bad', issue:'Disproportionate penalty clause', law:'Contracts Act 1950 s.75', desc:'A RM 500,000 penalty for a freelancer doing creative work is wholly disproportionate to any reasonable loss and will be struck down under s.75.', suggestion:'Replace with a reasonable pre-estimate of actual loss, or remove and rely on damages at law.' },
      ]},
      { title: '5. TERMINATION', clauses: [
        { id:'5.1', text:'The Client may terminate this Agreement at any time without notice or payment of outstanding fees.', status:'bad', issue:'Withholding earned fees on termination', law:'Contracts Act 1950', desc:'Fees already earned cannot be withheld upon termination. Work already performed entitles the Freelancer to payment regardless of termination.', suggestion:'Replace with: "Upon termination, the Client shall pay all fees for work completed up to the termination date."' },
        { id:'5.2', text:'The Freelancer may not terminate this Agreement without paying a termination fee of RM 20,000 to the Client.', status:'bad', issue:'One-sided termination penalty', law:'Contract law / Contracts Act 1950 s.75', desc:'Imposing a RM 20,000 exit fee only on the Freelancer (but not the Client) is one-sided, disproportionate, and likely void as a penalty clause.', suggestion:'Remove this clause. If a termination notice period is needed, require reasonable notice (e.g., 14 days) from both parties equally.' },
      ]},
      { title: '6. GOVERNING LAW', clauses: [
        { id:'6.1', text:'This Agreement is governed by the laws of Malaysia.', status:'ok' },
      ]},
    ]
  },
  {
    id: 5,
    filename: 'Contract_5_Tenancy_UrbanNest.pdf',
    company: 'UrbanNest Properties Sdn. Bhd.',
    date: '5 Jun 2026', time: '10:20 AM',
    status: 'critical',
    title: 'TENANCY AGREEMENT',
    subtitle: 'Residential Property — Kuala Lumpur',
    meta: ["Between: UrbanNest Properties Sdn. Bhd. (Co. No. 201801067890) ('Landlord')", "And: Nurul Izzati binti Hassan (NRIC: 000817-14-2345) ('Tenant')", 'Date: 10 June 2026'],
    sig: ['UrbanNest Properties Sdn. Bhd.', 'Nurul Izzati binti Hassan'],
    sections: [
      { title: '1. PROPERTY AND TERM', clauses: [
        { id:'1.1', text:"The Landlord agrees to let and the Tenant agrees to take the property located at Unit 12-3A, Residensi Mawar, Jalan Ampang, 50450 Kuala Lumpur ('the Property') for a term of 12 months commencing 1 July 2026.", status:'ok' },
      ]},
      { title: '2. RENT AND DEPOSITS', clauses: [
        { id:'2.1', text:'The monthly rental shall be RM 2,200, payable in advance on the 1st day of each month.', status:'ok' },
        { id:'2.2', text:'The Tenant shall pay a security deposit equivalent to 6 months\' rental (RM 13,200) upon signing this Agreement.', status:'warn', issue:'Excessive security deposit', law:'Malaysian tenancy norms', desc:'Industry norm and proposed Residential Tenancy Act limit security deposits to 2–3 months. 6 months is excessive and may be challenged.', suggestion:'Replace with: "The Tenant shall pay a security deposit equivalent to two (2) months\' rental (RM 4,400) upon signing this Agreement."' },
        { id:'2.3', text:'The security deposit shall be non-refundable under any circumstances.', status:'bad', issue:'Non-refundable deposit — unenforceable', law:'Contract law / common law', desc:'A deposit is by nature refundable less lawful deductions. A blanket non-refundable clause is void. Courts will order return of the deposit less proven deductions.', suggestion:'Replace with: "The security deposit shall be refunded within 14 days of the end of tenancy, less any deductions for damage beyond fair wear and tear or outstanding rent."' },
        { id:'2.4', text:'The Tenant shall also pay a utility deposit of RM 4,400 (2 months\' rental) in addition to the security deposit.', status:'warn', issue:'Total deposit burden very high', law:'Tenancy norms', desc:'Combined security + utility deposit of 8 months\' rental (RM 17,600) is disproportionate. Consider reducing utility deposit to actual utility provider requirements.', suggestion:'Replace utility deposit with: "A utility deposit of RM 300 or the amount required by the utility provider, whichever is lower."' },
      ]},
      { title: '3. LANDLORD\'S RIGHT OF ENTRY', clauses: [
        { id:'3.1', text:'The Landlord or its agents may enter the Property at any time, day or night, without prior notice to the Tenant, for inspection, repair, or any other purpose.', status:'bad', issue:'Entry without notice — violates quiet enjoyment', law:'Common law / tenant rights', desc:"Entry without notice violates the Tenant's right to quiet enjoyment, a fundamental implied term of any tenancy. This clause is unenforceable.", suggestion:'Replace with: "The Landlord may enter the Property for inspection or repair upon giving at least 24 hours\' prior written notice, except in genuine emergencies."' },
        { id:'3.2', text:'The Landlord may change the locks of the Property at any time without informing the Tenant.', status:'bad', issue:'Lock changing — unlawful eviction', law:'Specific Relief Act 1950', desc:"Changing locks without notice constitutes illegal eviction under Malaysian law and may expose the Landlord to criminal liability.", suggestion:'Remove this clause entirely. Landlords may not change locks without a court order.' },
      ]},
      { title: '4. REPAIRS AND MAINTENANCE', clauses: [
        { id:'4.1', text:'The Tenant shall be solely responsible for all repairs and maintenance of the Property, including structural repairs, roof repairs, and replacement of all fixtures and fittings regardless of fair wear and tear.', status:'bad', issue:'Tenant liable for structural repairs', law:'Common law / landlord obligations', desc:'Structural repairs (roof, walls, foundations) are the landlord\'s responsibility at common law. This cannot be transferred to the Tenant.', suggestion:'Replace with: "The Tenant shall maintain the Property in good condition and is responsible for minor repairs under RM 200. Structural repairs and major maintenance remain the Landlord\'s responsibility."' },
        { id:'4.2', text:'The Landlord shall have no obligation to carry out any repairs during the tenancy period.', status:'bad', issue:'Landlord disclaims all repair obligations', law:'Common law', desc:"A landlord cannot wholly disclaim repair obligations implied by law, particularly for structural elements and essential services.", suggestion:'Remove this clause. Insert: "The Landlord shall maintain the structural integrity and essential services of the Property in good repair throughout the tenancy."' },
      ]},
      { title: '5. TERMINATION', clauses: [
        { id:'5.1', text:'The Landlord may terminate this Agreement at any time without notice and require the Tenant to vacate the Property within 24 hours.', status:'bad', issue:'24-hour forced vacation — unlawful eviction', law:'Specific Relief Act 1950', desc:'Requiring a Tenant to vacate within 24 hours without court order constitutes unlawful eviction and is actionable in court.', suggestion:'Replace with: "Either party may terminate with two (2) months\' written notice. Eviction may only be effected through a court order."' },
        { id:'5.2', text:'The Tenant may only terminate this Agreement by providing 6 months\' written notice, failing which the full remaining rent for the tenancy term shall be payable immediately.', status:'bad', issue:'One-sided termination — 6 months notice for Tenant only', law:'Contract law', desc:"Requiring 6 months' notice from the Tenant (but allowing 0 notice from the Landlord) is grossly one-sided and may be voided as an unfair contract term.", suggestion:'Replace with: "Either party may terminate this Agreement by providing two (2) months\' written notice to the other party."' },
      ]},
      { title: '6. SUBLETTING', clauses: [
        { id:'6.1', text:"The Tenant shall not sublet the Property without the Landlord's written consent, such consent not to be unreasonably withheld.", status:'ok' },
      ]},
      { title: '7. GOVERNING LAW', clauses: [
        { id:'7.1', text:'This Agreement shall be governed by the laws of Malaysia.', status:'ok' },
      ]},
    ]
  }
];
