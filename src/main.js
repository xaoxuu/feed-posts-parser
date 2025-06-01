import * as core from '@actions/core';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { logger, handleError, withRetry, ConcurrencyPool, writeJsonToFile, formatDate } from './utils.js';

const DATA_FILE_PATH = path.join(process.cwd(), core.getInput('data_path') || '/v2/data.json');
const RETRY_TIMES = parseInt(core.getInput('retry_times') || '3');
const POSTS_COUNT = parseInt(core.getInput('posts_count') || '2');
const DATE_FORMAT = core.getInput('date_format') || 'YYYY-MM-DD HH:mm';

async function parseFeed(feedUrl) {
  try {
    const response = await axios.get(feedUrl, { timeout: 5000 });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const posts = [];

    $('feed > entry').slice(0, POSTS_COUNT).each((i, el) => {
      const title = $(el).find('title').text();
          let link = $(el).find('link[rel="alternate"]').attr('href');
          if (!link) {
            link = $(el).find('link').attr('href');
          }
      const published = $(el).find('published').text();
      const formattedPublished = published ? formatDate(published, DATE_FORMAT) : '';
      logger('info', `Extracted - Title: ${title}, Link: ${link}, Published: ${formattedPublished}`);
      if (title && link) {
        posts.push({ title, link, published: formattedPublished });
      }
    });

    return posts;
  } catch (error) {
    handleError(error, `Error parsing feed from ${feedUrl}`);
    return [];
  }
}

async function run() {
  try {
    logger('info', 'Starting feed post parser...');

    const data = JSON.parse(fs.readFileSync(DATA_FILE_PATH, 'utf8'));
    const concurrencyPool = new ConcurrencyPool(5); // Limit to 5 concurrent requests

    const updatedContent = await Promise.all(data.content.map(async (item) => {
      if (item.feed) {
        logger('info', `Processing feed for ${item.title || item.url}: ${item.feed}`);
        const posts = await concurrencyPool.add(() => withRetry(() => parseFeed(item.feed), RETRY_TIMES));
        return { ...item, posts };
      }
      return item;
    }));

    data.content = updatedContent;
    writeJsonToFile(DATA_FILE_PATH, data);

    logger('info', 'Feed post parsing completed.');

  } catch (error) {
    handleError(error, 'Main process failed');
    core.setFailed(error.message);
  }
}

run();