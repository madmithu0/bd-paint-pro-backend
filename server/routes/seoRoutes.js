const express = require('express');
const ServiceCategory = require('../models/ServiceCategory');

const router = express.Router();

const BASE_URL = process.env.CLIENT_URL || 'https://bdpaintpro.com';

const DISTRICTS = [
  'dhaka',
  'chattogram',
  'sylhet',
  'rajshahi',
  'khulna',
  'barishal',
  'rangpur',
  'mymensingh',
  'gazipur',
  'narayanganj',
  'cumilla',
  'bogura',
];

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const services = await ServiceCategory.find({ isActive: true })
      .select('code updatedAt')
      .lean();

    const staticUrls = ['', '/services', '/materials', '/warranty-verify', '/contract'];
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://sitemaps.org">\n';

    staticUrls.forEach((path) => {
      xml += `  <url><loc>${BASE_URL}${path}</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n`;
    });

    services.forEach((srv) => {
      const slug = String(srv.code || '').toLowerCase();
      xml += `  <url><loc>${BASE_URL}/services/${slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    });

    DISTRICTS.forEach((dist) => {
      xml += `  <url><loc>${BASE_URL}/location/${dist}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    });

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    return res.status(200).send(xml);
  } catch (error) {
    next(error);
  }
});

router.get('/robots.txt', (req, res) => {
  const content = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /superadmin',
    'Disallow: /dashboard',
    `Sitemap: ${BASE_URL}/api/seo/sitemap.xml`,
  ].join('\n');

  res.header('Content-Type', 'text/plain');
  return res.status(200).send(content);
});

router.get('/meta/:district', async (req, res) => {
  const district = String(req.params.district || 'Bangladesh').trim();
  const formatted = district.charAt(0).toUpperCase() + district.slice(1).toLowerCase();

  return res.status(200).json({
    success: true,
    district: formatted,
    title: `Best House Painting & Waterproofing Mistri Service in ${formatted} | BD Paint Pro`,
    description: `Hire NID-verified painting Mistris in ${formatted} with transparent per-Sqft pricing, 30% escrow protection, and 1-3 year digital QR warranty.`,
  });
});

module.exports = router;
