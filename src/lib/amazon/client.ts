import SellingPartnerAPI from 'amazon-sp-api';

// Create a singleton instance of the SP-API client
let amazonSpApiClient: any = null;

export function getAmazonClient() {
  if (!amazonSpApiClient) {
    if (!process.env.AMAZON_CLIENT_ID || !process.env.AMAZON_CLIENT_SECRET || !process.env.AMAZON_REFRESH_TOKEN) {
       console.warn('SP-API Auth Missing. Configure as credenciais no .env.local antes de usar a api verdadeira.');
       return null;
    }

    try {
      // @ts-ignore : CommonJS vs ESM issue on amazon-sp-api typing
      amazonSpApiClient = new SellingPartnerAPI({
        region: process.env.AMAZON_APP_REGION || 'na', 
        refresh_token: process.env.AMAZON_REFRESH_TOKEN,
        options: {
          auto_request_tokens: true,
          use_ids_for_response: false,
        },
        credentials: {
          SELLING_PARTNER_APP_CLIENT_ID: process.env.AMAZON_CLIENT_ID,
          SELLING_PARTNER_APP_CLIENT_SECRET: process.env.AMAZON_CLIENT_SECRET,
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '', 
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
          AWS_SELLING_PARTNER_ROLE: process.env.AWS_ROLE_ARN || '',
        }
      });
    } catch (e) {
      console.error('Falha ao inicializar o Amazon SP-API SDK:', e);
      return null;
    }
  }

  return amazonSpApiClient;
}
