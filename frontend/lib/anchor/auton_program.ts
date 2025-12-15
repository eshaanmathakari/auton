/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/auton_program.json`.
 */
export type AutonProgram = {
  "address": "9Dpgf1nWom5Psp6vwLs1J6WF7dVbySQwk8HhLSqXx62n",
  "metadata": {
    "name": "autonProgram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addContent",
      "discriminator": [
        183,
        126,
        202,
        103,
        73,
        114,
        135,
        191
      ],
      "accounts": [
        {
          "name": "creatorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "encryptedCid",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "initialFeePercentage",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeCreator",
      "discriminator": [
        29,
        153,
        44,
        99,
        52,
        172,
        81,
        115
      ],
      "accounts": [
        {
          "name": "creatorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "processPayment",
      "discriminator": [
        189,
        81,
        30,
        198,
        139,
        186,
        115,
        23
      ],
      "accounts": [
        {
          "name": "paidAccessAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  99,
                  101,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "arg",
                "path": "contentId"
              }
            ]
          }
        },
        {
          "name": "protocolConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "creatorAccount",
          "writable": true
        },
        {
          "name": "creatorWallet",
          "writable": true
        },
        {
          "name": "adminWallet",
          "writable": true
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "contentId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "registerUsername",
      "discriminator": [
        134,
        54,
        123,
        181,
        28,
        151,
        36,
        0
      ],
      "accounts": [
        {
          "name": "usernameAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  110,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "username"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "username",
          "type": "string"
        }
      ]
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "protocolConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newAdminWallet",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newFeePercentage",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "updateProfile",
      "discriminator": [
        98,
        67,
        99,
        206,
        86,
        115,
        175,
        1
      ],
      "accounts": [
        {
          "name": "creatorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "profileCid",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "creatorAccount",
      "discriminator": [
        222,
        163,
        32,
        169,
        204,
        8,
        200,
        32
      ]
    },
    {
      "name": "paidAccessAccount",
      "discriminator": [
        231,
        188,
        255,
        33,
        153,
        205,
        111,
        44
      ]
    },
    {
      "name": "protocolConfig",
      "discriminator": [
        207,
        91,
        250,
        28,
        152,
        179,
        215,
        209
      ]
    },
    {
      "name": "usernameAccount",
      "discriminator": [
        120,
        2,
        212,
        44,
        208,
        63,
        20,
        122
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "You are not authorized to perform this action."
    },
    {
      "code": 6001,
      "name": "contentNotFound",
      "msg": "The specified content was not found in the creator's account."
    },
    {
      "code": 6002,
      "name": "invalidUsername",
      "msg": "Invalid username. Must be 3-32 characters, alphanumeric or underscore only."
    },
    {
      "code": 6003,
      "name": "invalidFeePercentage",
      "msg": "Invalid fee percentage. Must be <= 10000 (100%)."
    }
  ],
  "types": [
    {
      "name": "contentItem",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "encryptedCid",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "creatorAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creatorWallet",
            "type": "pubkey"
          },
          {
            "name": "lastContentId",
            "type": "u64"
          },
          {
            "name": "content",
            "type": {
              "vec": {
                "defined": {
                  "name": "contentItem"
                }
              }
            }
          },
          {
            "name": "profileCid",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "paidAccessAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "contentId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "protocolConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "adminWallet",
            "type": "pubkey"
          },
          {
            "name": "feePercentage",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "usernameAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "username",
            "type": "string"
          }
        ]
      }
    }
  ]
};
