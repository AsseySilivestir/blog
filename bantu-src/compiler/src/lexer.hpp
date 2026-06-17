#pragma once
/**
 * Bantu Language - High-Performance Lexer/Tokenizer
 * All keywords in English, optimized with perfect hash lookup
 */

#include "types.hpp"
#include <cctype>
#include <unordered_map>

class Lexer {
public:
    explicit Lexer(const std::string& source) : source_(source), pos_(0), line_(1), col_(1) {}

    std::vector<Token> tokenize() {
        std::vector<Token> tokens;
        tokens.reserve(source_.size() / 4); // Pre-allocate for performance

        while (pos_ < source_.size()) {
            skipWhitespace();
            if (pos_ >= source_.size()) break;

            char c = source_[pos_];

            // Block comments /* */
            if (c == '/' && pos_ + 1 < source_.size() && source_[pos_ + 1] == '*') {
                skipBlockComment();
                continue;
            }

            // Line comments //
            if (c == '/' && pos_ + 1 < source_.size() && source_[pos_ + 1] == '/') {
                skipLineComment();
                continue;
            }

            // Strings
            if (c == '\'' || c == '"') {
                tokens.push_back(readString());
                continue;
            }

            // Numbers
            if (std::isdigit(static_cast<unsigned char>(c))) {
                tokens.push_back(readNumber());
                continue;
            }

            // Variable declarator $
            if (c == '$') {
                tokens.emplace_back(TokenType::DECLARATOR, "$", line_, col_);
                advance();
                continue;
            }

            // Identifiers / Keywords
            if (std::isalpha(static_cast<unsigned char>(c)) || c == '_') {
                tokens.push_back(readIdentifier());
                continue;
            }

            // Three-character operators
            if (pos_ + 2 < source_.size()) {
                std::string threeChar = source_.substr(pos_, 3);
                if (threeChar == "===") { tokens.emplace_back(TokenType::EQUALTO, "===", line_, col_); advance(); advance(); advance(); continue; }
                if (threeChar == "!==") { tokens.emplace_back(TokenType::NOTEQUALTO, "!==", line_, col_); advance(); advance(); advance(); continue; }
            }

            // Two-character operators
            if (pos_ + 1 < source_.size()) {
                std::string twoChar = source_.substr(pos_, 2);
                if (twoChar == "=>")  { tokens.emplace_back(TokenType::FATARROW, "=>", line_, col_); advance(); advance(); continue; }
                if (twoChar == "==")  { tokens.emplace_back(TokenType::EQUALTO, "==", line_, col_); advance(); advance(); continue; }
                if (twoChar == "!=")  { tokens.emplace_back(TokenType::NOTEQUALTO, "!=", line_, col_); advance(); advance(); continue; }
                if (twoChar == ">=")  { tokens.emplace_back(TokenType::GREATERTHANEQUAL, ">=", line_, col_); advance(); advance(); continue; }
                if (twoChar == "<=")  { tokens.emplace_back(TokenType::LESSTHANEQUAL, "<=", line_, col_); advance(); advance(); continue; }
                if (twoChar == "&&")  { tokens.emplace_back(TokenType::AND, "&&", line_, col_); advance(); advance(); continue; }
                if (twoChar == "||")  { tokens.emplace_back(TokenType::OR, "||", line_, col_); advance(); advance(); continue; }
                if (twoChar == "+=")  { tokens.emplace_back(TokenType::PLUS_EQUALS, "+=", line_, col_); advance(); advance(); continue; }
                if (twoChar == "-=")  { tokens.emplace_back(TokenType::MINUS_EQUALS, "-=", line_, col_); advance(); advance(); continue; }
                if (twoChar == "*=")  { tokens.emplace_back(TokenType::MULTIPLY_EQUALS, "*=", line_, col_); advance(); advance(); continue; }
                if (twoChar == "/=")  { tokens.emplace_back(TokenType::DIVIDE_EQUALS, "/=", line_, col_); advance(); advance(); continue; }
                if (twoChar == "++")  { tokens.emplace_back(TokenType::INCREMENT, "++", line_, col_); advance(); advance(); continue; }
                if (twoChar == "--")  { tokens.emplace_back(TokenType::DECREMENT, "--", line_, col_); advance(); advance(); continue; }
            }

            // Single-character tokens
            TokenType tt = charToTokenType(c);
            if (tt != TokenType::UNRECOGNIZED) {
                tokens.emplace_back(tt, std::string(1, c), line_, col_);
                advance();
                continue;
            }

            ErrorHandler::throwSyntaxError("Unrecognized character: " + std::string(1, c), line_, col_);
            advance();
        }

        tokens.emplace_back(TokenType::END_OF_FILE, "", line_, col_);
        return tokens;
    }

private:
    std::string source_;
    size_t pos_;
    int line_;
    int col_;

    void advance() {
        if (pos_ < source_.size()) {
            if (source_[pos_] == '\n') { line_++; col_ = 1; }
            else { col_++; }
            pos_++;
        }
    }

    void skipWhitespace() {
        while (pos_ < source_.size() && std::isspace(static_cast<unsigned char>(source_[pos_]))) {
            advance();
        }
    }

    void skipLineComment() {
        while (pos_ < source_.size() && source_[pos_] != '\n') advance();
    }

    void skipBlockComment() {
        advance(); advance(); // skip /*
        while (pos_ + 1 < source_.size()) {
            if (source_[pos_] == '*' && source_[pos_ + 1] == '/') {
                advance(); advance(); // skip */
                return;
            }
            advance();
        }
        ErrorHandler::throwSyntaxError("Unterminated block comment", line_, col_);
    }

    Token readString() {
        char quote = source_[pos_];
        int startLine = line_, startCol = col_;
        advance();
        std::string value;
        while (pos_ < source_.size() && source_[pos_] != quote) {
            if (source_[pos_] == '\\') {
                advance();
                if (pos_ < source_.size()) {
                    switch (source_[pos_]) {
                        case 'n': value += '\n'; break;
                        case 't': value += '\t'; break;
                        case 'r': value += '\r'; break;
                        case '\\': value += '\\'; break;
                        case '\'': value += '\''; break;
                        case '"': value += '"'; break;
                        case '0': value += '\0'; break;
                        default: value += source_[pos_]; break;
                    }
                }
            } else {
                value += source_[pos_];
            }
            advance();
        }
        if (pos_ < source_.size()) advance();
        return Token(TokenType::STRING, value, startLine, startCol);
    }

    Token readNumber() {
        int startLine = line_, startCol = col_;
        std::string value;
        bool hasDecimal = false;
        while (pos_ < source_.size() && (std::isdigit(static_cast<unsigned char>(source_[pos_])) || source_[pos_] == '.')) {
            if (source_[pos_] == '.') {
                if (hasDecimal) break;
                // Check if next char is a digit (avoid treating 5.toString as number)
                if (pos_ + 1 < source_.size() && !std::isdigit(static_cast<unsigned char>(source_[pos_ + 1]))) break;
                hasDecimal = true;
            }
            value += source_[pos_];
            advance();
        }
        return Token(TokenType::NUMBER, value, startLine, startCol);
    }

    Token readIdentifier() {
        int startLine = line_, startCol = col_;
        std::string value;
        while (pos_ < source_.size() && (std::isalnum(static_cast<unsigned char>(source_[pos_])) || source_[pos_] == '_')) {
            value += source_[pos_];
            advance();
        }
        TokenType tt = keywordToTokenType(value);
        return Token(tt, value, startLine, startCol);
    }

    static TokenType charToTokenType(char c) {
        switch (c) {
            case '+': return TokenType::PLUS;
            case '-': return TokenType::MINUS;
            case '*': return TokenType::MULTIPLY;
            case '/': return TokenType::DIVIDE;
            case '%': return TokenType::MODULO;
            case '=': return TokenType::EQUALS;
            case '>': return TokenType::GREATERTHAN;
            case '<': return TokenType::LESSTHAN;
            case '!': return TokenType::NOT;
            case '(': return TokenType::LPAREN;
            case ')': return TokenType::RPAREN;
            case '{': return TokenType::LBRACE;
            case '}': return TokenType::RBRACE;
            case '[': return TokenType::LBRACKET;
            case ']': return TokenType::RBRACKET;
            case ':': return TokenType::COLON;
            case '|': return TokenType::PIPE;
            case ',': return TokenType::COMMA;
            case ';': return TokenType::SEMICOLON;
            case '.': return TokenType::DOT;
            default: return TokenType::UNRECOGNIZED;
        }
    }

    static TokenType keywordToTokenType(const std::string& word) {
        static const std::unordered_map<std::string, TokenType> keywords = {
            // Control flow
            {"if",       TokenType::IF},
            {"else",     TokenType::ELSE},
            {"while",    TokenType::WHILE},
            {"for",      TokenType::FOR},
            {"each",     TokenType::EACH},
            {"in",       TokenType::IN},
            {"switch",   TokenType::SWITCH},
            {"case",     TokenType::CASE},
            {"default",  TokenType::DEFAULT},
            {"break",    TokenType::BREAK},
            {"continue", TokenType::CONTINUE},

            // Functions
            {"def",      TokenType::DEF},
            {"return",   TokenType::RETURN},

            // I/O
            {"print",    TokenType::PRINT},
            {"read",     TokenType::READ},
            {"db",       TokenType::DB},
            {"fetch",    TokenType::FETCH},
            {"await",    TokenType::AWAIT},

            // Modifiers
            {"const",    TokenType::CONST},
            {"private",  TokenType::PRIVATE},
            {"public",   TokenType::PUBLIC},
            {"from",     TokenType::FROM},

            // Error handling
            {"try",      TokenType::TRY},
            {"catch",    TokenType::CATCH},

            // Object operations
            {"new",      TokenType::NEW},
            {"create",   TokenType::CREATE},
            {"delete",   TokenType::DELETE},
            {"update",   TokenType::UPDATE},
            {"calc",     TokenType::CALC},

            // Class
            {"class",     TokenType::CLASS},
            {"extends",   TokenType::EXTENDS},
            {"implements",TokenType::IMPLEMENTS},
            {"super",     TokenType::SUPER},

            // Module
            {"import",   TokenType::IMPORT},
            {"export",   TokenType::EXPORT},

            // Real-Time (sua framework)
            {"channel",   TokenType::CHANNEL},
            {"signal",    TokenType::SIGNAL},
            {"stun",      TokenType::STUN},
            {"stream",    TokenType::STREAM},
            {"broadcast", TokenType::BROADCAST},
            {"relay",     TokenType::RELAY},
            {"connect",   TokenType::CONNECT},
            {"peer",      TokenType::PEER},
            {"ice",       TokenType::ICE},
            {"candidate", TokenType::CANDIDATE},
            {"room",      TokenType::ROOM},
            {"offer",     TokenType::OFFER},
            {"answer",    TokenType::ANSWER},

            // Values
            {"true",     TokenType::TRUE},
            {"false",    TokenType::FALSE},
            {"null",     TokenType::NULL_T},

            // Type annotations
            {"number",   TokenType::TYPE_NUMBER},
            {"string",   TokenType::TYPE_STRING},
            {"bool",     TokenType::TYPE_BOOL},
            {"list",     TokenType::TYPE_LIST},
            {"dict",     TokenType::TYPE_DICT},
            {"any",      TokenType::TYPE_ANY},
            {"func",     TokenType::TYPE_FUNC},
        };
        auto it = keywords.find(word);
        if (it != keywords.end()) return it->second;
        return TokenType::IDENTIFIER;
    }
};
