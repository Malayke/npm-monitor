/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// Simple XML parser function
function parseXML(xmlText) {
	// console.log('Starting XML parsing...');
	const items = [];
	const itemRegex = /<item>([\s\S]*?)<\/item>/g;
	const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/;
	const linkRegex = /<link>(.*?)<\/link>/;
	const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;
	const descriptionRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>/;
	const creatorRegex = /<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/;

	let match;
	// let count = 0;
	while ((match = itemRegex.exec(xmlText)) !== null) {
		// console.log(`Processing item ${count + 1}...`);
		const itemContent = match[1];
		const titleMatch = itemContent.match(titleRegex);
		const linkMatch = itemContent.match(linkRegex);
		const pubDateMatch = itemContent.match(pubDateRegex);
		const descriptionMatch = itemContent.match(descriptionRegex);
		const creatorMatch = itemContent.match(creatorRegex);

		if (titleMatch && linkMatch && pubDateMatch) {
			const name = titleMatch[1].trim();
			const link = linkMatch[1].trim();
			const pubDate = new Date(pubDateMatch[1].trim());
			const description = descriptionMatch ? descriptionMatch[1].trim() : '';
			const creator = creatorMatch ? creatorMatch[1].trim() : '';

			// console.log(`Parsed package: ${name}`);
			// console.log(`Link: ${link}`);
			// console.log(`Published at: ${pubDate.toISOString()}`);
			// console.log(`Description: ${description}`);
			// console.log(`Creator: ${creator}`);

			items.push({
				name,
				link,
				published_at: pubDate.toISOString(),
				description,
				creator
			});
		} else {
			console.log('Failed to parse item:', itemContent);
		}
		// count++;
	}

	// console.log(`Total items parsed: ${items.length}`);
	return items;
}

/**
 * Finds the latest version from a JSON object containing version strings
 * @param {Object} versions - JSON object with environment names as keys and version strings as values
 * @returns {string} - The latest version string
 */
function findLatestVersion(versions) {
	if (!versions || typeof versions !== 'object' || Object.keys(versions).length === 0) {
	  return null;
	}
	
	// Extract all version strings
	const versionStrings = Object.values(versions);
	
	// Compare versions by splitting into components and comparing numerically
	return versionStrings.reduce((latestVersion, currentVersion) => {
	  const latestParts = latestVersion.split('.').map(Number);
	  const currentParts = currentVersion.split('.').map(Number);
	  
	  // Compare each part of the version
	  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
		// If a part is missing, treat it as 0
		const latestPart = latestParts[i] || 0;
		const currentPart = currentParts[i] || 0;
		
		if (currentPart > latestPart) {
		  return currentVersion;
		} else if (currentPart < latestPart) {
		  return latestVersion;
		}
	  }
	  
	  // If all parts are equal, return the current version
	  return latestVersion;
	});
  }
  

async function getLatestVersionFromAPI(packageName) {
	try {
		const response = await fetch(`https://registry.npmjs.org/-/package/${packageName}/dist-tags`);
		if (!response.ok) {
			console.error(`Failed to fetch version for ${packageName}: ${response.status} ${response.statusText}`);
			return null;
		}
		const data = await response.json();
		if (!data) {
			console.error(`No data found for ${packageName}`);
			return null;
		}
		const latestVersion = findLatestVersion(data);
		// console.log(`Latest version for ${packageName}: ${latestVersion}`);
		return latestVersion;
	} catch (error) {
		console.error(`Error fetching version for ${packageName}:`, error);
		return null;
	}
}
// Function to parse version information from npm package page
async function getLatestVersion(packageLink) {
	console.log(`\nFetching version for package: ${packageLink}`);
	
	try {
		const versionsUrl = `${packageLink}?activeTab=versions`;
		console.log(`Fetching versions from: ${versionsUrl}`);
		
		const response = await fetch(versionsUrl);
		const html = await response.text();
		// console.log('Successfully fetched versions page');
		
		const result = await parseVersions(html);
		
		if (!result.closestVersion) {
			console.error(`Failed to find version for package: ${packageLink}`);
			throw new Error(`No version found for package: ${packageLink}`);
		}
		
		return result.closestVersion;
	} catch (error) {
		console.error(`Error fetching version for ${packageLink}:`, error);
		throw error; // Re-throw the error instead of returning 'latest'
	}
}

// Function to parse versions from HTML content
async function parseVersions(html) {
	const versions = new Map(); // Use Map to store unique versions with their dates
	const currentTime = new Date();
	let closestVersion = null;
	let minTimeDiff = Infinity;
	
	// Create a new response with the HTML content
	const res = new Response(html);
	
	// Track the current version and its date
	let currentVersion = null;
	let currentDate = null;
	
	await new HTMLRewriter()
		.on('tr', {
			element(element) {
				// At the start of each row, reset the current version and date
				currentVersion = null;
				currentDate = null;
			}
		})
		.on('td a.code', {
			text(text) {
				// This is the version number
				const version = text.text.trim();
				if (version) { // Accept any non-empty version string
					currentVersion = version;
				}
			}
		})
		.on('time', {
			element(element) {
				const datetime = element.getAttribute('datetime');
				if (datetime && currentVersion) {
					try {
						const versionDate = new Date(datetime);
						if (!isNaN(versionDate.getTime())) {
							currentDate = versionDate;
							
							// Only update if we don't have a date for this version yet
							// or if this date is earlier than the existing one
							if (!versions.has(currentVersion) || 
								versionDate < versions.get(currentVersion).date) {
								
								const timeDiff = Math.abs(currentTime - versionDate);
								versions.set(currentVersion, {
									version: currentVersion,
									date: versionDate,
									timeDiff
								});
								
								// console.log(`\nFound version: ${currentVersion}`);
								// console.log(`Version date: ${versionDate.toISOString()}`);
								// console.log(`Time difference: ${timeDiff}ms`);
								
								if (timeDiff < minTimeDiff) {
									minTimeDiff = timeDiff;
									closestVersion = currentVersion;
									// console.log(`Package: ${packageName} - New closest version: ${closestVersion}`);
								}
							}
						}
					} catch (error) {
						console.error(`Error parsing date for version ${currentVersion}`, error);
					}
				}
			}
		})
		.transform(res)
		.text();
	
	// Convert Map to array and filter out versions without valid dates
	const validVersions = Array.from(versions.values())
		.filter(v => v.date !== null && !isNaN(v.date.getTime()));
	
	// console.log(`\nTotal versions found: ${validVersions.length}`);
	
	if (validVersions.length > 0) {
		// Sort versions by time difference for debugging
		validVersions.sort((a, b) => a.timeDiff - b.timeDiff);
		// console.log('\nAll versions sorted by time difference:');
		validVersions.forEach(v => {
			// console.log(`Version: ${v.version}, Date: ${v.date.toISOString()}, Diff: ${v.timeDiff}ms`);
		});
	}
	
	return {
		closestVersion,
		allVersions: validVersions
	};
}

// Function to check if package exists in database
async function checkPackageExists(env, name, version) {
	const result = await env.DB.prepare(
		'SELECT 1 FROM npm_packages WHERE name = ? AND version = ?'
	).bind(name, version).first();
	return result !== null;
}

// Queue consumer function
async function queueConsumer(batch, env) {
	console.log(`Queue consumer: Processing batch of ${batch.messages.length} messages`);
	
	for (const message of batch.messages) {
		try {
			const { name, version, published_at, description, creator } = message.body;
			
			// Check if package already exists
			const exists = await checkPackageExists(env, name, version);
			if (exists) {
				// console.log(`Package ${name} version ${version} already exists in database`);
				continue;
			}
			
			// Save package to database
			await env.DB.prepare(
				'INSERT INTO npm_packages (name, version, published_at) VALUES (?, ?, ?)'
			).bind(name, version, published_at).run();
			console.log(`Queue consumer: Package: ${name} - ${version} saved to database`);
			
			// Send notification to Slack
			if (env.SLACK_WEBHOOK_URL) {
				const message = {
					data: `New npm package published!\nName: ${name}\nVersion: ${version}\nDescription: ${description}\nCreator: ${creator}\nPublished at: ${published_at}`,
					package: name,
				};
				
				await fetch(env.SLACK_WEBHOOK_URL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(message)
				});
			}
		} catch (error) {
			console.error('Queue consumer: Error processing message:', error);
			// Don't throw the error to prevent message retry
			// The message will be retried automatically based on max_retries configuration
		}
	}
}

export default {
	async fetch(req) {
		try {
			// console.log('\n=== Starting fetch request ===');
			
			// Get package name from URL query parameter
			const url = new URL(req.url);
			const packageName = url.searchParams.get('package');
			
			if (!packageName) {
				return new Response(JSON.stringify({ error: 'Package name is required. Use ?package=package-name' }), {
					status: 400,
					headers: {
						'Content-Type': 'application/json'
					}
				});
			}
			
			const packageUrl = `https://www.npmjs.com/package/${packageName}?activeTab=versions`;
			// console.log(`Fetching versions from: ${packageUrl}`);
			
			const response = await fetch(packageUrl);
			const html = await response.text();
			// console.log('Successfully fetched versions page');
			
			const result = await parseVersions(html);
			
			return new Response(JSON.stringify(result, null, 2), {
				headers: {
					'Content-Type': 'application/json'
				}
			});
		} catch (error) {
			console.error('Error in fetch handler:', error);
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: {
					'Content-Type': 'application/json'
				}
			});
		}
	},

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env, ctx) {
		try {
			// Fetch the RSS feed
			const response = await fetch('https://registry.npmjs.org/-/rss');
			const xmlText = await response.text();
			
			// Parse the XML content
			const packages = parseXML(xmlText);
			
			// Process each package
			for (const pkg of packages) {
				// Get the latest version
				const version = await getLatestVersionFromAPI(pkg.name);
				
				// Validate values before queueing
				if (!pkg.name || !version || !pkg.published_at) {
					console.error('Skipping queue due to missing values:', {
						name: pkg.name,
						version: version,
						published_at: pkg.published_at
					});
					continue;
				}
				
				// Send package to queue
				await env.PACKAGE_QUEUE.send({
					name: pkg.name,
					version: version,
					published_at: pkg.published_at,
					description: pkg.description,
					creator: pkg.creator
				});
				console.log(`Scheduled handler: Package: ${pkg.name} - ${version} queued for processing`);
			}
			
			return new Response('Successfully queued npm packages', { status: 200 });
		} catch (error) {
			console.error('Scheduled handler: Error in scheduled task:', error);

		}
	},

	// Queue consumer handler
	async queue(batch, env, ctx) {
		await queueConsumer(batch, env);
	}
};
