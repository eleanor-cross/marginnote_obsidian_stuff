/**
 * MarginNote Database Reader
 * Reads SQLite database and converts to MbBookNote objects
 */

import { MbBookNote } from '../models/MbBookNote';

export interface DatabaseReader {
  booknotes: any[];
  topics: any[];
  media: any[];
}

export class MarginNoteDatabaseReader {
  private databaseData: DatabaseReader;
  
  constructor(databaseData: DatabaseReader) {
    this.databaseData = databaseData;
  }
  
  /**
   * Parse all book notes from the database
   */
  parseBookNotes(): MbBookNote[] {
    const notes: MbBookNote[] = [];
    
    console.log(`Processing ${this.databaseData.booknotes.length} book notes from database`);
    
    // Create topic lookup for faster access
    const topicLookup = new Map<string, any>();
    for (const topic of this.databaseData.topics) {
      const topicId = topic.ZTOPICID || topic.topicId;
      if (topicId) {
        topicLookup.set(topicId, topic);
      }
    }
    
    // Create media lookup
    const mediaLookup = new Map<string, any>();
    for (const media of this.databaseData.media) {
      const mediaId = media.ZMD5 || media.md5;
      if (mediaId) {
        mediaLookup.set(mediaId, media);
      }
    }
    
    // Process each book note
    for (const rawNote of this.databaseData.booknotes) {
      try {
        // Enhance note data with topic and media information
        const enhancedNote = this.enhanceNoteData(rawNote, topicLookup, mediaLookup);
        
        // Create MbBookNote object
        const note = new MbBookNote(enhancedNote);
        notes.push(note);
        
        console.log(`Created note: ${note.getDisplayTitle()} (${note.noteId})`);
      } catch (error) {
        console.warn(`Failed to process note:`, error);
        console.warn('Raw note data:', rawNote);
      }
    }
    
    console.log(`Successfully created ${notes.length} MbBookNote objects`);
    return notes;
  }
  
  /**
   * Enhance note data with topic and media information
   */
  private enhanceNoteData(rawNote: any, topicLookup: Map<string, any>, mediaLookup: Map<string, any>): any {
    const enhanced = { ...rawNote };
    
    // Add topic information
    const topicId = rawNote.ZTOPICID || rawNote.topicId;
    if (topicId && topicLookup.has(topicId)) {
      const topic = topicLookup.get(topicId);
      enhanced.topicTitle = topic.ZTITLE || topic.title;
      enhanced.topicType = this.parseTopicTypeFromTopic(topic);
    }
    
    // Parse and enhance media list
    const mediaList = rawNote.ZMEDIA_LIST || rawNote.mediaList;
    if (mediaList && typeof mediaList === 'string') {
      const mediaIds = mediaList.split('-').filter(id => id.length > 0);
      enhanced.mediaObjects = [];
      
      for (const mediaId of mediaIds) {
        if (mediaLookup.has(mediaId)) {
          enhanced.mediaObjects.push(mediaLookup.get(mediaId));
        }
      }
    }
    
    // Parse binary data if present (from modified CSV)
    if (rawNote.ZHIGHLIGHTS_DECODE && typeof rawNote.ZHIGHLIGHTS_DECODE === 'string') {
      try {
        enhanced.ZHIGHLIGHTS_DECODE = JSON.parse(rawNote.ZHIGHLIGHTS_DECODE);
      } catch (e) {
        console.warn('Failed to parse ZHIGHLIGHTS_DECODE:', e);
      }
    }
    
    if (rawNote.ZNOTES_DECODE && typeof rawNote.ZNOTES_DECODE === 'string') {
      try {
        enhanced.ZNOTES_DECODE = JSON.parse(rawNote.ZNOTES_DECODE);
      } catch (e) {
        console.warn('Failed to parse ZNOTES_DECODE:', e);
      }
    }
    
    if (rawNote.ZHIGLIGHTPIC_DECODE && typeof rawNote.ZHIGLIGHTPIC_DECODE === 'string') {
      try {
        enhanced.ZHIGLIGHTPIC_DECODE = JSON.parse(rawNote.ZHIGLIGHTPIC_DECODE);
      } catch (e) {
        console.warn('Failed to parse ZHIGLIGHTPIC_DECODE:', e);
      }
    }
    
    return enhanced;
  }
  
  /**
   * Parse topic type from topic data
   */
  private parseTopicTypeFromTopic(topic: any): string {
    // Check ZFORUMOWNER for topic type information
    const forumOwner = topic.ZFORUMOWNER || topic.forumOwner;
    if (forumOwner) {
      try {
        const parsed = JSON.parse(forumOwner);
        if (parsed.projectTopic) return 'project';
        if (parsed.bookTopic) return 'book';
        if (parsed.reviewTopic) return 'review';
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    return 'general';
  }
  
  /**
   * Get statistics about the database
   */
  getStatistics(): any {
    return {
      totalBooknotes: this.databaseData.booknotes.length,
      totalTopics: this.databaseData.topics.length,
      totalMedia: this.databaseData.media.length,
      notesWithHighlights: this.databaseData.booknotes.filter(n => n.ZHIGHLIGHT_TEXT).length,
      notesWithNotes: this.databaseData.booknotes.filter(n => n.ZNOTES_TEXT).length,
      notesWithMedia: this.databaseData.booknotes.filter(n => n.ZMEDIA_LIST).length,
      notesWithLinkedNotes: this.databaseData.booknotes.filter(n => n.ZMINDLINKS).length
    };
  }
}