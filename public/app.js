(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const tenantId = params.get('tenant') || 'wievonselbstai';
  const tenant = (window.CALCULATOR_TENANTS && window.CALCULATOR_TENANTS[tenantId]) || window.CALCULATOR_TENANTS.wievonselbstai;
  document.documentElement.style.setProperty('--accent', tenant.accent);
  document.documentElement.style.setProperty('--accent-dark', tenant.accentDark);
  $('brandText').textContent = tenant.logoText;
  $('year').textContent = new Date().getFullYear();
  if (params.get('embed') === '1') document.body.classList.add('embed-mode');

  const stepTitles = ['Deine Einnahmen', 'Deine Arbeitszeit', 'Unbezahlte Arbeitszeit', 'Deine Betriebskosten', 'Dein Ziel'];
  let currentStep = 0;
  let currentResult = null;
  let currentPdfBase64 = null;
  const stepPanels = [...document.querySelectorAll('.step-panel')];
  const weeklyFields = [
    ['prep', 'Vorbereitung & Planung'], ['email', 'E-Mails & Kundenkommunikation'], ['travel', 'Anfahrt & Reisezeit'],
    ['rework', 'Korrekturen & Nacharbeiten'], ['admin', 'Buchhaltung & Verwaltung'], ['sales', 'Akquise & Angebotserstellung'], ['otherTime', 'Sonstige Tätigkeiten']
  ];
  const costFields = [
    ['software', 'Software & Abonnements'], ['office', 'Büro & Arbeitsplatz'], ['insurance', 'Versicherungen'],
    ['phone', 'Telefon & Internet'], ['mobility', 'Fahrtkosten'], ['otherCosts', 'Sonstige Betriebskosten']
  ];
  const euro = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(n) ? n : 0);
  const number = (n, digits = 1) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
  const val = (id) => {
    const el = $(id);
    if (!el || el.value.trim() === '') return 0;
    const n = Number(el.value);
    return Number.isFinite(n) ? n : NaN;
  };
  const positive = (id) => {
    const n = val(id);
    return Number.isFinite(n) && n >= 0;
  };

  function showStep(index) {
    currentStep = index;
    stepPanels.forEach((p, i) => p.classList.toggle('active', i === index));
    $('stepTitle').textContent = stepTitles[index];
    $('stepNumber').textContent = String(index + 1);
    $('progressFill').style.width = `${((index + 1) / stepPanels.length) * 100}%`;
    $('backButton').disabled = index === 0;
    $('nextButton').innerHTML = index === stepPanels.length - 1 ? 'Ergebnis berechnen <span>→</span>' : 'Weiter <span>→</span>';
    $('formError').textContent = '';
  }
  function setIncomeMode(mode) {
    $('revenueFields').classList.toggle('hidden', mode !== 'revenue');
    $('hourlyFields').classList.toggle('hidden', mode !== 'hourly');
    document.querySelectorAll('.choice-card').forEach(card => card.classList.toggle('selected', card.querySelector('input').value === mode));
  }
  document.querySelectorAll('input[name="incomeMode"]').forEach(r => r.addEventListener('change', () => setIncomeMode(r.value)));

  function validateStep(index) {
    const mode = document.querySelector('input[name="incomeMode"]:checked').value;
    let error = '';
    if (index === 0) {
      if (mode === 'revenue' && !positive('monthlyRevenue')) error = 'Bitte gib einen gültigen monatlichen Umsatz von mindestens 0 € ein.';
      if (mode === 'hourly' && (!positive('hourlyRate') || !positive('billedHoursForRevenue') || val('billedHoursForRevenue') <= 0)) error = 'Bitte gib einen gültigen Stundensatz und mehr als 0 abrechenbare Stunden ein.';
    }
    if (index === 1) {
      if (!positive('billableHours') || val('billableHours') <= 0) error = 'Bitte gib mehr als 0 abrechenbare Stunden pro Monat ein.';
      if (mode === 'hourly' && Math.abs(val('billableHours') - val('billedHoursForRevenue')) > 0.01) error = 'Die abrechenbaren Stunden müssen mit den Stunden aus der Umsatzberechnung übereinstimmen.';
    }
    if (index === 2) {
      for (const [id] of weeklyFields) if (!positive(id)) error = 'Bitte verwende nur gültige, nicht negative Stundenwerte.';
    }
    if (index === 3) {
      for (const [id] of costFields) if (!positive(id)) error = 'Bitte verwende nur gültige, nicht negative Kostenwerte.';
    }
    if (index === 4 && !positive('targetSurplus')) error = 'Bitte gib einen gültigen Zielüberschuss ein (0 € ist möglich).';
    $('formError').textContent = error;
    return !error;
  }

  function collectAndCalculate() {
    const mode = document.querySelector('input[name="incomeMode"]:checked').value;
    const revenue = mode === 'revenue' ? val('monthlyRevenue') : val('hourlyRate') * val('billedHoursForRevenue');
    const billable = val('billableHours');
    const weeklyBreakdown = weeklyFields.map(([id, label]) => ({ id, label, weekly: val(id), monthly: val(id) * 4.33 }));
    const unpaid = weeklyBreakdown.reduce((sum, x) => sum + x.monthly, 0);
    const totalHours = billable + unpaid;
    const costs = costFields.reduce((sum, [id]) => sum + val(id), 0);
    const target = val('targetSurplus');
    const effective = totalHours > 0 ? revenue / totalHours : null;
    const contribution = totalHours > 0 ? (revenue - costs) / totalHours : null;
    const costRate = billable > 0 ? costs / billable : null;
    const targetRate = billable > 0 ? (costs + target) / billable : null;
    const share = totalHours > 0 ? billable / totalHours * 100 : 0;
    const revenueRate = billable > 0 ? revenue / billable : null;
    return {
      mode, revenue, billable, weeklyBreakdown, unpaid, totalHours, costs, target,
      effective, contribution, costRate, targetRate, share, revenueRate,
      generatedAt: new Date().toLocaleDateString('de-DE')
    };
  }

  function renderResults(r) {
    $('effectiveRate').textContent = r.effective === null ? '–' : `${euro(r.effective)} / Std.`;
    $('netRate').textContent = r.contribution === null ? '–' : `${euro(r.contribution)} / Std.`;
    $('costRate').textContent = r.costRate === null ? '–' : `${euro(r.costRate)} / Std.`;
    $('targetRate').textContent = r.targetRate === null ? '–' : `${euro(r.targetRate)} / Std.`;
    $('billableValue').textContent = `${number(r.billable)} Std.`;
    $('unpaidValue').textContent = `${number(r.unpaid)} Std.`;
    $('totalHours').textContent = `${number(r.totalHours)} Std.`;
    $('billableShare').textContent = `${number(r.share, 2)} %`;
    $('billableBar').style.width = `${r.share}%`;
    $('unpaidBar').style.width = `${100 - r.share}%`;
    const sorted = [...r.weeklyBreakdown].sort((a, b) => b.monthly - a.monthly);
    const max = Math.max(1, ...sorted.map(x => x.monthly));
    $('timeBreakdown').innerHTML = sorted.filter(x => x.monthly > 0).map(x => `<div class="breakdown-item"><span>${escapeHtml(x.label)}</span><strong>${number(x.monthly)} Std.</strong><div class="breakdown-track"><span style="width:${x.monthly / max * 100}%"></span></div></div>`).join('') || '<p class="muted">Keine zusätzlichen Arbeitszeiten angegeben.</p>';
    let text;
    if (r.unpaid === 0) text = 'Du hast keine zusätzliche unbezahlte Arbeitszeit angegeben. Prüfe, ob wirklich alle Tätigkeiten wie Verwaltung, Kundenkommunikation und Akquise berücksichtigt sind.';
    else text = `Du investierst zusätzlich rund <strong>${number(r.unpaid)} Stunden pro Monat</strong> in nicht direkt abgerechnete Tätigkeiten. Das entspricht <strong>${number(100 - r.share, 1)} %</strong> deiner gesamten Arbeitszeit. Prüfe, welche dieser Aufgaben sich durch bessere Abläufe, Vorlagen oder Automatisierungen vereinfachen lassen.`;
    if (r.contribution < 0) text += ' Deine Betriebskosten übersteigen in dieser Berechnung deinen Monatsumsatz.';
    $('interpretation').innerHTML = `<strong>Was bedeutet das?</strong><br>${text}`;
    $('results').classList.remove('hidden');
    $('calculatorForm').closest('.calculator-card').classList.add('hidden');
    $('emailPanel').classList.add('hidden');
    currentResult = r;
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function escapeHtml(str) { return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function buildPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('PDF-Bibliothek konnte nicht geladen werden. Bitte prüfe deine Internetverbindung.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const r = currentResult;
    const margin = 18;
    const pageWidth = 210;
    const green = [38, 116, 92];
    const dark = [28, 43, 36];
    const muted = [103, 117, 108];
    const line = [225, 233, 228];
    const addHeader = (title, subtitle) => {
      doc.setFillColor(...green); doc.rect(0, 0, pageWidth, 7, 'F');
      doc.setTextColor(...green); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(tenant.logoText, margin, 19);
      doc.setTextColor(...dark); doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.text(title, margin, 34);
      doc.setTextColor(...muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(subtitle, margin, 41);
      doc.setDrawColor(...line); doc.line(margin, 47, pageWidth - margin, 47);
    };
    const labelValue = (label, value, y, big = false) => {
      doc.setTextColor(...muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(label, margin, y);
      doc.setTextColor(...dark); doc.setFont('helvetica', 'bold'); doc.setFontSize(big ? 18 : 11); doc.text(value, pageWidth - margin, y, { align: 'right' });
    };
    const footer = (page) => { doc.setDrawColor(...line); doc.line(margin, 282, pageWidth-margin, 282); doc.setTextColor(...muted); doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.text(`${tenant.logoText} · Erstellt am ${r.generatedAt}`, margin, 288); doc.text(`Seite ${page}`, pageWidth-margin, 288, {align:'right'}); };

    // Seite 1
    addHeader('Dein echter Stundensatz', 'Individuelle Auswertung deiner Arbeitszeit und Betriebskosten');
    doc.setTextColor(...muted); doc.setFontSize(9); doc.text('DEIN EFFEKTIVER UMSATZ PRO ARBEITSSTUNDE', margin, 62);
    doc.setTextColor(...green); doc.setFont('helvetica','bold'); doc.setFontSize(30); doc.text(`${euro(r.effective)} / Std.`, margin, 77);
    doc.setTextColor(...muted); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text('Monatsumsatz geteilt durch deine gesamte angegebene Arbeitszeit.', margin, 85);
    doc.setDrawColor(...line); doc.line(margin, 94, pageWidth-margin, 94);
    labelValue('Monatlicher Umsatz', euro(r.revenue), 108, true);
    labelValue('Betriebliche Kosten pro Monat', euro(r.costs), 122);
    labelValue('Überschuss nach Betriebskosten', euro(r.revenue-r.costs), 136);
    labelValue('Gesamte Arbeitszeit', `${number(r.totalHours)} Std.`, 150);
    labelValue('Davon abrechenbar', `${number(r.billable)} Std.`, 164);
    labelValue('Zusätzliche Arbeitszeit', `${number(r.unpaid)} Std.`, 178);
    doc.setFillColor(242,247,244); doc.roundedRect(margin, 192, pageWidth-2*margin, 36, 3, 3, 'F');
    doc.setTextColor(...dark); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('Deine weiteren Kennzahlen', margin+6, 202);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text(`Überschuss je Arbeitsstunde: ${euro(r.contribution)}`, margin+6, 212);
    doc.text(`Abrechenbarer Anteil deiner Zeit: ${number(r.share,2)} %`, margin+6, 220);
    footer(1);

    // Seite 2
    doc.addPage(); addHeader('So verteilt sich deine Zeit', 'Monatliche Hochrechnung auf Basis deiner Angaben');
    let y = 62;
    r.weeklyBreakdown.forEach(item => {
      if (item.monthly <= 0) return;
      doc.setTextColor(...dark); doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(item.label, margin, y);
      doc.setFont('helvetica','bold'); doc.text(`${number(item.monthly)} Std.`, pageWidth-margin, y, {align:'right'});
      y += 4; doc.setFillColor(239,243,240); doc.roundedRect(margin, y, pageWidth-2*margin, 3, 1, 1, 'F');
      doc.setFillColor(213,139,53); doc.roundedRect(margin, y, (pageWidth-2*margin)*(item.monthly/Math.max(1,r.unpaid)), 3, 1, 1, 'F');
      y += 13;
    });
    y += 5; doc.setDrawColor(...line); doc.line(margin,y,pageWidth-margin,y); y += 12;
    labelValue('Abrechenbare Arbeitszeit', `${number(r.billable)} Std.`, y); y += 13;
    labelValue('Zusätzliche Arbeitszeit', `${number(r.unpaid)} Std.`, y); y += 13;
    labelValue('Gesamte Arbeitszeit', `${number(r.totalHours)} Std.`, y, true);
    footer(2);

    // Seite 3
    doc.addPage(); addHeader('Deine Stundensatz-Kennzahlen', 'Was deine Zahlen für die Kalkulation bedeuten');
    const rows = [
      ['Rechnerischer Umsatz je abrechenbarer Stunde', r.revenueRate === null ? 'Nicht berechenbar' : euro(r.revenueRate)],
      ['Effektiver Umsatz je Arbeitsstunde', euro(r.effective)],
      ['Überschuss je Arbeitsstunde nach Betriebskosten', euro(r.contribution)],
      ['Kostendeckender Mindeststundensatz', euro(r.costRate)],
      ['Erforderlicher Stundensatz für dein Ziel', euro(r.targetRate)]
    ];
    y = 67;
    rows.forEach(([label, value]) => {
      doc.setTextColor(...muted); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text(label, margin, y, {maxWidth:105});
      doc.setTextColor(...dark); doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text(value, pageWidth-margin, y, {align:'right'});
      doc.setDrawColor(...line); doc.line(margin,y+7,pageWidth-margin,y+7); y += 20;
    });
    y += 5; doc.setFillColor(242,247,244); doc.roundedRect(margin,y,pageWidth-2*margin,55,3,3,'F');
    doc.setTextColor(...dark); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('So werden die Werte berechnet', margin+6, y+10);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const explanation = [
      'Effektiver Umsatz je Arbeitsstunde = Monatsumsatz / gesamte Arbeitszeit.',
      'Überschuss je Arbeitsstunde = (Monatsumsatz - Betriebskosten) / gesamte Arbeitszeit.',
      'Kostendeckender Mindeststundensatz = Betriebskosten / abrechenbare Stunden.',
      'Erforderlicher Stundensatz = (Betriebskosten + gewünschter Überschuss) / abrechenbare Stunden.'
    ];
    explanation.forEach((t,i)=>doc.text(t,margin+6,y+20+i*8,{maxWidth:pageWidth-2*margin-12}));
    footer(3);

    // Seite 4
    doc.addPage(); addHeader('Deine nächsten Ansatzpunkte', 'Mögliche Verbesserungen für deinen Arbeitsalltag');
    y = 65;
    const top = [...r.weeklyBreakdown].sort((a,b)=>b.monthly-a.monthly).filter(x=>x.monthly>0).slice(0,3);
    doc.setTextColor(...dark); doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Deine größten zusätzlichen Zeitaufwände', margin, y); y += 12;
    if (!top.length) { doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text('Du hast keine zusätzliche Arbeitszeit angegeben. Prüfe, ob alle wiederkehrenden Aufgaben berücksichtigt sind.', margin, y, {maxWidth:pageWidth-2*margin}); y += 22; }
    top.forEach((x,i)=>{doc.setTextColor(...green);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(`${i+1}. ${x.label}`,margin,y);doc.setTextColor(...dark);doc.text(`${number(x.monthly)} Std./Monat`,pageWidth-margin,y,{align:'right'});y+=10;});
    y += 9; doc.setTextColor(...dark); doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Mögliche Vereinfachungen', margin, y); y += 11;
    const recommendations = [
      'Wiederkehrende E-Mail-Antworten mit Textbausteinen oder Regeln vereinfachen.',
      'Angebote, Dokumente und wiederkehrende Formulare mit Vorlagen standardisieren.',
      'Termine, Erinnerungen und Aufgaben über Kalender- oder Workflow-Automatisierungen verbinden.',
      'Datenübertragungen zwischen Tabellen und Programmen automatisieren.'
    ];
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); recommendations.forEach(t=>{doc.setFillColor(...green);doc.circle(margin+1,y-1,1,'F');const lines=doc.splitTextToSize(t,pageWidth-2*margin-8);doc.text(lines,margin+7,y);y+=lines.length*5+6;});
    y += 8; doc.setFillColor(242,247,244); doc.roundedRect(margin,y,pageWidth-2*margin,34,3,3,'F');
    doc.setTextColor(...dark); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('Weniger Routine. Mehr Zeit für dein Geschäft.', margin+6, y+11);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.text('wievonselbstai unterstützt dich mit praktischen Anleitungen und individuellen Umsetzungen.', margin+6, y+20, {maxWidth:pageWidth-2*margin-12});
    footer(4);
    return doc;
  }

  function getPdfBase64(doc) {
    const dataUri = doc.output('datauristring');
    return dataUri.split(',')[1];
  }
  function downloadReport() {
    try {
      const doc = buildPdf();
      doc.save('wievonselbstai-echter-stundensatz.pdf');
      currentPdfBase64 = getPdfBase64(doc);
    } catch (e) { showToast(e.message || 'PDF konnte nicht erstellt werden.'); }
  }
  function showToast(message) {
    $('toast').textContent = message; $('toast').classList.add('show');
    setTimeout(() => $('toast').classList.remove('show'), 3200);
  }

  $('nextButton').addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < stepPanels.length - 1) showStep(currentStep + 1);
    else renderResults(collectAndCalculate());
  });
  $('backButton').addEventListener('click', () => { if (currentStep > 0) showStep(currentStep - 1); });
  $('downloadPdf').addEventListener('click', downloadReport);
  $('emailReport').addEventListener('click', () => { $('emailPanel').classList.remove('hidden'); $('emailPanel').scrollIntoView({behavior:'smooth',block:'center'}); });
  $('closeEmail').addEventListener('click', () => $('emailPanel').classList.add('hidden'));
  $('restartButton').addEventListener('click', () => {
    $('calculatorForm').reset();
    ['prep','email','travel','rework','admin','sales','otherTime','software','office','insurance','phone','mobility','otherCosts'].forEach(id => $(id).value = '0');
    $('results').classList.add('hidden'); $('calculatorForm').closest('.calculator-card').classList.remove('hidden'); $('emailPanel').classList.add('hidden');
    setIncomeMode('revenue'); showStep(0); window.scrollTo({top:0,behavior:'smooth'});
  });

  $('emailForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('emailAddress').value.trim();
    const firstName = $('firstName').value.trim();
    if (!email || !$('emailAddress').checkValidity()) { $('emailStatus').textContent = 'Bitte gib eine gültige E-Mail-Adresse ein.'; $('emailStatus').className='email-status error'; return; }
    const button = $('sendEmailButton'); button.disabled = true; button.textContent = 'Report wird versendet …';
    $('emailStatus').textContent = 'Dein PDF wird erstellt und versendet.'; $('emailStatus').className='email-status';
    try {
      const doc = buildPdf();
      const pdfBase64 = getPdfBase64(doc);
      const response = await fetch('/api/send-report', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ tenantId, email, firstName, pdfBase64 })
      });
      const payload = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(payload.error || 'Der Versand ist derzeit nicht möglich.');
      $('emailStatus').textContent = 'Der PDF-Report wurde versendet. Bitte prüfe dein Postfach.';
      $('emailStatus').className = 'email-status success';
    } catch (error) {
      $('emailStatus').textContent = error.message || 'Beim Versand ist ein Fehler aufgetreten.';
      $('emailStatus').className = 'email-status error';
    } finally {
      button.disabled = false; button.innerHTML = 'PDF jetzt senden <span>→</span>';
    }
  });
  showStep(0);
})();
