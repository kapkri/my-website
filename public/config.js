// Öffentliche, nicht geheime Rechner-Konfiguration.
// Später kann dieses Objekt durch eine Supabase-Abfrage ersetzt werden.
window.CALCULATOR_TENANTS = {
  wievonselbstai: {
    name: 'wievonselbstai',
    logoText: 'WIEVONSELBSTAI',
    accent: '#26745c',
    accentDark: '#1d5947',
    emailFromLabel: 'wievonselbstai',
    reportTitle: 'Dein echter Stundensatz',
    website: 'https://wievonselbstai.de',
    contactEmail: ''
  },
  demo: {
    name: 'Demo-Kunde',
    logoText: 'DEMO',
    accent: '#315e9b',
    accentDark: '#244776',
    emailFromLabel: 'Demo-Rechner',
    reportTitle: 'Dein echter Stundensatz',
    website: '',
    contactEmail: ''
  }
};
