    // Process assets
    cardData.assets = await Promise.all(
      cardData.assets.map(async (descriptor) => {
        if (!descriptor.uri) {
            console.log(`[Card Import] Asset ${descriptor.name} has no URI`);
            return descriptor;
        }
        
        let buffer: Buffer | undefined;
        let mimetype: string | undefined;

        // Case 1: Data URI
        if (descriptor.uri.startsWith('data:')) {
          try {
            const matches = descriptor.uri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              mimetype = matches[1];
              buffer = Buffer.from(matches[2], 'base64');
            } else {
              warnings.push(`Invalid Data URI for asset ${descriptor.name}`);
            }
          } catch (e) {
            warnings.push(`Failed to parse Data URI for ${descriptor.name}: ${e}`);
          }
        } 
        // Case 2: PNG Chunk Reference (e.g. __asset:0)
        else if (extraChunks && (descriptor.uri.startsWith('__asset:') || !descriptor.uri.includes(':') || descriptor.uri.startsWith('asset:'))) {
            let assetId = descriptor.uri;
            if (descriptor.uri.startsWith('__asset:')) assetId = descriptor.uri.split(':')[1];
            if (descriptor.uri.startsWith('asset:')) assetId = descriptor.uri.split(':')[1];
            
            // Try different key variations
            const candidates = [
                assetId,                        // "0" or "filename.png"
                descriptor.uri,                 // "__asset:0"
                `asset:${assetId}`,             // "asset:0"
                `__asset_${assetId}`,           // "__asset_0"
                `chara-ext-asset_${assetId}`,   // "chara-ext-asset_0" or "chara-ext-asset_filename.png"
                `chara-ext-asset_:${assetId}`   // "chara-ext-asset_:0" (implied by user comment about :90)
            ];

            const chunk = extraChunks.find(c => candidates.includes(c.keyword)) || 
                          extraChunks.find(c => {
                              // Fallback: Check for chara-ext-asset_ prefix matching
                              if (c.keyword.startsWith('chara-ext-asset_')) {
                                  const suffix = c.keyword.replace('chara-ext-asset_', '');
                                  return suffix === assetId || suffix === `:${assetId}` || suffix === descriptor.uri;
                              }
                              return false;
                          });
            
            if (chunk) {
                console.log(`[Card Import] Found embedded asset chunk for ${descriptor.uri} (key: ${chunk.keyword})`);
                try {
                    buffer = Buffer.from(chunk.text, 'base64');
                    // Guess mimetype from extension if available
                    if (descriptor.ext) {
                        mimetype = getMimeTypeFromExt(descriptor.ext);
                    } else {
                        mimetype = 'application/octet-stream'; // Fallback
                    }
                } catch (e) {
                    warnings.push(`Failed to decode embedded asset chunk ${chunk.keyword}: ${e}`);
                }
            } else {
                console.warn(`[Card Import] Referenced asset chunk not found: ${descriptor.uri} (checked: ${candidates.join(', ')})`);
                // Don't spam logs with all chunks if there are too many, just show first few matching pattern
                if (extraChunks) {
                    const similarChunks = extraChunks.filter(c => c.keyword.includes('asset') || c.keyword.includes(assetId));
                    if (similarChunks.length > 0) {
                        console.warn(`[Card Import] Similar chunks found: ${similarChunks.map(c => `"${c.keyword}"`).join(', ')}`);
                    }
                }
            }
        }
