/**
 * W3C DID Core spec types — https://www.w3.org/TR/did-core/
 *
 * Method: did:semse
 * Format:  did:semse:<userId>
 *
 * No public key stored yet (verificationMethod empty). The DID Document
 * serves as a stable, resolvable identity anchor with service endpoints
 * pointing to trust passport and reputation. Public key support can be
 * added later without changing the DID identifier.
 */

export type DidVerificationMethod = {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
};

export type DidServiceEndpoint = {
  id: string;
  type: string;
  serviceEndpoint: string;
};

export type DidDocument = {
  "@context": string[];
  id: string;
  controller: string;
  verificationMethod: DidVerificationMethod[];
  authentication: string[];
  service: DidServiceEndpoint[];
  "semse:metadata": {
    verificationStatus: string;
    reputationTier: string;
    createdAt: string;
    resolvedAt: string;
  };
};

export type DidResolutionResult = {
  "@context": "https://w3id.org/did-resolution/v1";
  didDocument: DidDocument;
  didResolutionMetadata: {
    contentType: "application/did+ld+json";
    retrieved: string;
  };
  didDocumentMetadata: {
    created: string;
    method: "semse";
  };
};
