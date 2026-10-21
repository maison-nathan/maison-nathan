const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 455, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    // Construction de la liste des produits pour Stripe
    const lineItems = data.items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.title,
          description: item.description,
        },
        unit_amount: item.amount * 100, // Prix en centimes
      },
      quantity: 1,
    }));

    // Configuration de l'option de livraison (6 € si livraison en France)
    let shippingOptions = [];
    if (data.order_type === 'delivery') {
      shippingOptions = [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 600, // 6.00 EUR en centimes
              currency: 'eur',
            },
            display_name: 'Frais de livraison (Colissimo / Mondial Relay)',
          },
        },
      ];
    }

    // Création de la session de paiement sécurisée Stripe
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: data.email_client,
      metadata: {
        client_name: `${data.prenom_client} ${data.nom_client}`,
        client_phone: data.telephone_client,
        order_details: JSON.stringify(data),
      },
      success_url: `${event.headers.origin}/?status=success`,
      cancel_url: `${event.headers.origin}/?status=cancel`,
    };

    // Ajout des frais de port si applicables
    if (shippingOptions.length > 0) {
      sessionConfig.shipping_options = shippingOptions;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error('Erreur Stripe Checkout:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};