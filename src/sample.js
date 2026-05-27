const smsInputPayload = `
Dear MR N S DODANTENNA,LKR 5,800.00 Debited from your A/c XXXXXXXX1234 on 25/05/2026 at 11:49.AvlBal LKR 123,456.78.Utility Payment.Thank you for banking with us.Call Centre 1972.

Dear MR N S DODANTENNA,LKR 870.00 Debited from your A/c XXXXXXXX1234 on 24/05/2026 at 15:04.AvlBal LKR 123,567.89.ATM POS Transaction.Thank you for banking with us.Call Centre 1972.

Dear MR N S DODANTENNA,LKR 123,456.78 Credited to your A/c XXXXXXXX1234 on 29/04/2026 at 22:30.AvlBal LKR 123,456.78.Transaction CEFT Inward Transfer Deposit.Thank you for banking with us.Call Centre 1972.

Purchase. Transaction approved on your Credit Card 4835 **** **** 1234 for LKR 1335.00 at KEELLS-KOTTAWA 02 KOTTAWA. Balance Available LKR 123456.03

Dear Customer, Thank you for payment of LKR 1234.97 on 07/01/2026 for Credit Card no. 4835 **** **** 1234. Balance Available LKR 299900n

Online Transfer Credit Rs 12345.00 To A/C No XXXXXXXXXX123. Balance available Rs 12345.59 - Thank you for banking with BOC

CEFT Transfer Debit Rs 12345.00 From A/C No XXXXXXXXXX123. Balance available Rs 5000.59 - Thank you for banking with BOC
`;

function parseBulkSMS(text) {
  const parsedRecords = [];

  const patterns = {
    nsbDebit: /LKR\s+([0-9,]+\.[0-9]{2})\s+(Debited|Credited)\s+(?:from|to)\s+your\s+A\/c\s+(\S+)\s+on\s+([0-9/]+)\s+at\s+([0-9:]+)\.?\s*AvlBal\s+LKR\s+([0-9,]+\.[0-9]{2})\.?\s*(.*?)\.Thank/gi,
    // bocCredit handled below with more flexible line-based parsing
    bocDebit: /(Credit|Debit)\s+Rs\s+([0-9,]+\.[0-9]{2})\s+(?:To|From)\s+A\/C\s+No\s+(\S+?)\.?\s+Balance\s+available\s+Rs\s+([0-9,]+\.[0-9]{2})/gi
  };

  // 1. Process NSB
  for (const match of text.matchAll(patterns.nsbDebit)) {
    parsedRecords.push({
      category: "NSB Debit",
      accountOrCard: match[3],
      type: match[2],
      amount: parseFloat(match[1].replace(/,/g, '')),
      balance: parseFloat(match[6].replace(/,/g, '')),
      details: match[7].trim(),
      timestamp: `${match[4]} ${match[5]}`
    });
  }

  // 2. Process BOC Credit
  // BOC credit messages come in a few different forms. Parse them line-by-line
  // and extract card, amount, balance, merchant and optional date when present.
  const bocLines = text.split(/\r?\n/).filter(line => /Credit Card|Transaction approved|Thank you for payment|Purchase/i.test(line) && /(LKR|Rs)/i.test(line));

  for (const line of bocLines) {
    // card token - sequence of digits, stars and spaces (e.g. "4835 **** **** 1234")
    const cardMatch = line.match(/([0-9* ]{12,})/);
    // amount (first LKR/Rs amount in the line)
    const amountMatch = line.match(/(?:LKR|Rs)\s*([0-9,]+\.[0-9]{2})/i);
    // balance - try both LKR and Rs variants
    const balanceMatch = line.match(/Balance\s+Available\s+LKR\s*([0-9,]+(?:\.[0-9]{2})?)/i) || line.match(/Balance\s+available\s+Rs\s*([0-9,]+\.[0-9]{2})/i);
    // optional date like "on 07/01/2026"
    const dateMatch = line.match(/on\s+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i);
    // merchant after 'at' if present — capture full merchant name until a period, the word 'Balance', or end of line
    const merchantMatch = line.match(/\bat\s+(.+?)(?:\.|Balance\b|$)/i);

    // determine type: payments are credits to card, transactions/purchases are debits
    const type = /thank you for payment|payment of/i.test(line) ? 'Credited' : /purchase|transaction approved|approved/i.test(line) ? 'Debited' : null;

    // Decide details: if it's a payment (credited), set to 'payment'; otherwise use merchant when available
    let details;
    if (type === 'Credited' && /thank you for payment|payment of/i.test(line)) {
      details = 'payment';
    } else if (merchantMatch) {
      details = merchantMatch[1].trim();
    } else {
      details = line.trim();
    }

    parsedRecords.push({
      category: "BOC Credit",
      accountOrCard: cardMatch ? cardMatch[1].trim().replace(/\s+/g, ' ') : null,
      type: type || 'Unknown',
      amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
      balance: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : null,
      details,
      timestamp: dateMatch ? dateMatch[1] : null
    });
  }

  // 3. Process BOC Debit
  for (const match of text.matchAll(patterns.bocDebit)) {
    // attempt to extract the full merchant name from the line containing this match
    const idx = typeof match.index === 'number' ? match.index : -1;
    const lineStart = idx > -1 ? text.lastIndexOf('\n', idx) : -1;
    const lineEnd = idx > -1 ? text.indexOf('\n', idx) : -1;
    const contextLine = text.substring(lineStart === -1 ? 0 : lineStart + 1, lineEnd === -1 ? text.length : lineEnd);
    const merchantMatch = contextLine.match(/\bat\s+(.+?)(?:\.|Balance\b|$)/i);
    const details = merchantMatch ? merchantMatch[1].trim() : "Account Transfer";

    parsedRecords.push({
      category: "BOC Debit",
      accountOrCard: match[3],
      type: match[1] === "Credit" ? "Credited" : "Debited",
      amount: parseFloat(match[2].replace(/,/g, '')),
      balance: parseFloat(match[4].replace(/,/g, '')),
      details,
      timestamp: null
    });
  }

  return parsedRecords;
}

console.log(parseBulkSMS(smsInputPayload));
