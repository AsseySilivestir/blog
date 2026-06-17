#pragma once
/**
 * Bantu Language - Recursive Descent Parser
 * Transforms token stream into AST
 */

#include "types.hpp"
#include "ast.hpp"
#include <vector>
#include <memory>
#include <stdexcept>

class Parser {
public:
    explicit Parser(std::vector<Token> tokens) : tokens_(std::move(tokens)), pos_(0) {}

    std::vector<std::shared_ptr<ASTNode>> parse() {
        std::vector<std::shared_ptr<ASTNode>> program;
        while (!isAtEnd()) {
            auto stmt = parseStatement();
            if (stmt) program.push_back(std::move(stmt));
        }
        return program;
    }

private:
    std::vector<Token> tokens_;
    size_t pos_;

    // ─── Helpers ───
    const Token& current() const { return tokens_[pos_]; }
    const Token& peek(int offset = 0) const { return tokens_[pos_ + offset]; }
    bool isAtEnd() const { return current().type == TokenType::END_OF_FILE; }

    Token advance() {
        if (!isAtEnd()) pos_++;
        return tokens_[pos_ - 1];
    }

    bool check(TokenType type) const { return !isAtEnd() && current().type == type; }

    bool match(TokenType type) {
        if (check(type)) { advance(); return true; }
        return false;
    }

    Token expect(TokenType type, const std::string& msg) {
        if (check(type)) return advance();
        ErrorHandler::throwSyntaxError(msg + " (got: '" + current().value + "')", current().line, current().col);
        return current();
    }

    // ─── Statement Parsing ───
    std::shared_ptr<ASTNode> parseStatement() {
        if (check(TokenType::IF))       return parseIf();
        if (check(TokenType::WHILE))    return parseWhile();
        if (check(TokenType::FOR))      return parseFor();
        if (check(TokenType::EACH))     return parseEach();
        if (check(TokenType::DEF))      return parseFuncDecl();
        if (check(TokenType::RETURN))   return parseReturn();
        if (check(TokenType::PRINT))    return parsePrint();
        if (check(TokenType::TRY))      return parseTryCatch();
        if (check(TokenType::BREAK))    { advance(); return std::make_shared<ASTNode>(current().line, current().col); }
        if (check(TokenType::CONTINUE)) { advance(); return std::make_shared<ASTNode>(current().line, current().col); }
        if (check(TokenType::CLASS))    return parseClass();
        if (check(TokenType::CONST))    return parseConstDecl();

        // Type-annotated variable declarations: number, string, bool, list, dict
        if (check(TokenType::TYPE_NUMBER) || check(TokenType::TYPE_STRING) ||
            check(TokenType::TYPE_BOOL)   || check(TokenType::TYPE_LIST) ||
            check(TokenType::TYPE_DICT)   || check(TokenType::TYPE_ANY) ||
            check(TokenType::TYPE_FUNC))  return parseTypeDecl();

        return parseExpressionStatement();
    }

    std::shared_ptr<ASTNode> parseIf() {
        int line = current().line, col = current().col;
        advance(); // skip 'if'
        expect(TokenType::LPAREN, "Expected '(' after 'if'");
        auto condition = parseExpression();
        expect(TokenType::RPAREN, "Expected ')' after condition");
        auto body = parseBlock();

        std::vector<std::shared_ptr<ASTNode>> elseBody;
        if (match(TokenType::ELSE)) {
            elseBody = parseBlock();
        }

        return std::make_shared<IfNode>(std::move(condition), std::move(body), std::move(elseBody), line, col);
    }

    std::shared_ptr<ASTNode> parseWhile() {
        int line = current().line, col = current().col;
        advance(); // skip 'while'
        expect(TokenType::LPAREN, "Expected '(' after 'while'");
        auto condition = parseExpression();
        expect(TokenType::RPAREN, "Expected ')' after condition");
        auto body = parseBlock();
        return std::make_shared<WhileNode>(std::move(condition), std::move(body), line, col);
    }

    std::shared_ptr<ASTNode> parseFor() {
        int line = current().line, col = current().col;
        advance(); // skip 'for'
        expect(TokenType::LPAREN, "Expected '(' after 'for'");
        auto init = parseStatement();
        match(TokenType::SEMICOLON); // optional semicolon after for-init (type declarations already consume it)
        auto condition = parseExpression();
        expect(TokenType::SEMICOLON, "Expected ';' after for-condition");
        auto update = parseStatement();
        expect(TokenType::RPAREN, "Expected ')' after for-update");
        auto body = parseBlock();
        return std::make_shared<ForNode>(std::move(init), std::move(condition), std::move(update), std::move(body), line, col);
    }

    std::shared_ptr<ASTNode> parseEach() {
        int line = current().line, col = current().col;
        advance(); // skip 'each'
        expect(TokenType::LPAREN, "Expected '(' after 'each'");
        expect(TokenType::DECLARATOR, "Expected '$' before variable name in each");
        auto varToken = expect(TokenType::IDENTIFIER, "Expected variable name in each");
        expect(TokenType::IN, "Expected 'in' in each loop");
        auto iterable = parseExpression();
        expect(TokenType::RPAREN, "Expected ')' after each iterable");
        auto body = parseBlock();
        return std::make_shared<EachNode>(varToken.value, std::move(iterable), std::move(body), line, col);
    }

    std::shared_ptr<ASTNode> parseFuncDecl() {
        int line = current().line, col = current().col;
        advance(); // skip 'def'
        auto nameToken = expect(TokenType::IDENTIFIER, "Expected function name after 'def'");
        expect(TokenType::LPAREN, "Expected '(' after function name");

        std::vector<std::string> params;
        if (!check(TokenType::RPAREN)) {
            do {
                if (match(TokenType::DECLARATOR)) { /* skip $ */ }
                auto param = expect(TokenType::IDENTIFIER, "Expected parameter name");
                params.push_back(param.value);
            } while (match(TokenType::COMMA));
        }
        expect(TokenType::RPAREN, "Expected ')' after parameters");
        auto body = parseBlock();
        return std::make_shared<FuncDeclNode>(nameToken.value, std::move(params), std::move(body), line, col);
    }

    std::shared_ptr<ASTNode> parseReturn() {
        int line = current().line, col = current().col;
        advance(); // skip 'return'
        auto value = parseExpression();
        match(TokenType::SEMICOLON);
        return std::make_shared<ReturnNode>(std::move(value), line, col);
    }

    std::shared_ptr<ASTNode> parsePrint() {
        int line = current().line, col = current().col;
        advance(); // skip 'print'
        auto value = parseExpression();
        match(TokenType::SEMICOLON);
        return std::make_shared<PrintNode>(std::move(value), line, col);
    }

    std::shared_ptr<ASTNode> parseTryCatch() {
        int line = current().line, col = current().col;
        advance(); // skip 'try'
        auto tryBody = parseBlock();
        expect(TokenType::CATCH, "Expected 'catch' after try block");
        expect(TokenType::LPAREN, "Expected '(' after 'catch'");
        match(TokenType::DECLARATOR);
        auto catchVar = expect(TokenType::IDENTIFIER, "Expected error variable name");
        expect(TokenType::RPAREN, "Expected ')' after catch variable");
        auto catchBody = parseBlock();
        return std::make_shared<TryCatchNode>(std::move(tryBody), catchVar.value, std::move(catchBody), line, col);
    }

    std::shared_ptr<ASTNode> parseClass() {
        int line = current().line, col = current().col;
        advance(); // skip 'class'
        auto nameToken = expect(TokenType::IDENTIFIER, "Expected class name after 'class'");

        // Parse optional extends (single inheritance)
        std::string parentClass = "";
        if (match(TokenType::EXTENDS)) {
            auto parentToken = expect(TokenType::IDENTIFIER, "Expected parent class name after 'extends'");
            parentClass = parentToken.value;
        }

        // Parse optional implements (multiple inheritance)
        std::vector<std::string> implementsClasses;
        if (match(TokenType::IMPLEMENTS)) {
            do {
                auto implToken = expect(TokenType::IDENTIFIER, "Expected class name after 'implements'");
                implementsClasses.push_back(implToken.value);
            } while (match(TokenType::COMMA));
        }

        // Parse class body
        expect(TokenType::LBRACE, "Expected '{' to start class body");

        std::vector<std::shared_ptr<ASTNode>> body;
        while (!check(TokenType::RBRACE) && !check(TokenType::END_OF_FILE)) {
            // Parse method definitions (def name(...) { ... })
            if (check(TokenType::DEF)) {
                body.push_back(parseFuncDecl());
            } else {
                // Parse property declarations or other statements
                body.push_back(parseStatement());
            }
        }

        expect(TokenType::RBRACE, "Expected '}' to close class body");

        return std::make_shared<ClassDeclNode>(nameToken.value, parentClass,
            std::move(implementsClasses), std::move(body), line, col);
    }

    std::shared_ptr<ASTNode> parseConstDecl() {
        int line = current().line, col = current().col;
        advance(); // skip 'const'
        match(TokenType::DECLARATOR);
        auto nameToken = expect(TokenType::IDENTIFIER, "Expected variable name");
        expect(TokenType::EQUALS, "Expected '=' in const declaration");
        auto init = parseExpression();
        match(TokenType::SEMICOLON);
        return std::make_shared<VarDeclNode>("const", nameToken.value, std::move(init), line, col);
    }

    std::shared_ptr<ASTNode> parseTypeDecl() {
        int line = current().line, col = current().col;
        std::string typeAnnotation = current().value;
        advance(); // skip type keyword
        match(TokenType::DECLARATOR);
        auto nameToken = expect(TokenType::IDENTIFIER, "Expected variable name");
        expect(TokenType::EQUALS, "Expected '=' in variable declaration");
        auto init = parseExpression();
        match(TokenType::SEMICOLON);
        return std::make_shared<VarDeclNode>(typeAnnotation, nameToken.value, std::move(init), line, col);
    }

    std::shared_ptr<ASTNode> parseExpressionStatement() {
        auto expr = parseExpression();
        match(TokenType::SEMICOLON);
        return expr;
    }

    // ─── Block Parsing ───
    std::vector<std::shared_ptr<ASTNode>> parseBlock() {
        std::vector<std::shared_ptr<ASTNode>> statements;
        expect(TokenType::LBRACE, "Expected '{'");
        while (!check(TokenType::RBRACE) && !isAtEnd()) {
            statements.push_back(parseStatement());
        }
        expect(TokenType::RBRACE, "Expected '}'");
        return statements;
    }

    // ─── Expression Parsing (Precedence Climbing) ───
    std::shared_ptr<ASTNode> parseExpression() {
        return parseAssignment();
    }

    std::shared_ptr<ASTNode> parseAssignment() {
        auto expr = parseOr();

        if (match(TokenType::EQUALS)) {
            auto value = parseAssignment();
            if (auto varNode = dynamic_cast<VariableNode*>(expr.get())) {
                return std::make_shared<AssignNode>(varNode->name, std::move(value), expr->line, expr->col);
            }
            // Handle $arr[$idx] = value
            if (auto idxNode = dynamic_cast<IndexAccessNode*>(expr.get())) {
                return std::make_shared<IndexAssignNode>(std::move(idxNode->object), std::move(idxNode->index), std::move(value), expr->line, expr->col);
            }
            // Handle $dict["key"] = value
            if (auto dotNode = dynamic_cast<DotAccessNode*>(expr.get())) {
                return std::make_shared<DictAssignNode>(std::move(dotNode->object), dotNode->property, std::move(value), expr->line, expr->col);
            }
            ErrorHandler::throwSyntaxError("Invalid assignment target", expr->line, expr->col);
        }

        if (match(TokenType::PLUS_EQUALS) || match(TokenType::MINUS_EQUALS) ||
            match(TokenType::MULTIPLY_EQUALS) || match(TokenType::DIVIDE_EQUALS)) {
            // Compound assignment
            auto op = tokens_[pos_ - 1].type;
            auto value = parseAssignment();
            if (auto varNode = dynamic_cast<VariableNode*>(expr.get())) {
                auto binOp = std::make_shared<BinaryOpNode>(op, std::make_shared<VariableNode>(varNode->name, varNode->line, varNode->col), std::move(value), expr->line, expr->col);
                return std::make_shared<AssignNode>(varNode->name, std::move(binOp), expr->line, expr->col);
            }
        }

        return expr;
    }

    std::shared_ptr<ASTNode> parseOr() {
        auto left = parseAnd();
        while (match(TokenType::OR)) {
            auto right = parseAnd();
            left = std::make_shared<BinaryOpNode>(TokenType::OR, std::move(left), std::move(right), current().line, current().col);
        }
        return left;
    }

    std::shared_ptr<ASTNode> parseAnd() {
        auto left = parseEquality();
        while (match(TokenType::AND)) {
            auto right = parseEquality();
            left = std::make_shared<BinaryOpNode>(TokenType::AND, std::move(left), std::move(right), current().line, current().col);
        }
        return left;
    }

    std::shared_ptr<ASTNode> parseEquality() {
        auto left = parseComparison();
        while (check(TokenType::EQUALTO) || check(TokenType::NOTEQUALTO)) {
            auto op = advance().type;
            auto right = parseComparison();
            left = std::make_shared<BinaryOpNode>(op, std::move(left), std::move(right), current().line, current().col);
        }
        return left;
    }

    std::shared_ptr<ASTNode> parseComparison() {
        auto left = parseAddition();
        while (check(TokenType::GREATERTHAN) || check(TokenType::GREATERTHANEQUAL) ||
               check(TokenType::LESSTHAN) || check(TokenType::LESSTHANEQUAL)) {
            auto op = advance().type;
            auto right = parseAddition();
            left = std::make_shared<BinaryOpNode>(op, std::move(left), std::move(right), current().line, current().col);
        }
        return left;
    }

    std::shared_ptr<ASTNode> parseAddition() {
        auto left = parseMultiplication();
        while (check(TokenType::PLUS) || check(TokenType::MINUS)) {
            auto op = advance().type;
            auto right = parseMultiplication();
            left = std::make_shared<BinaryOpNode>(op, std::move(left), std::move(right), current().line, current().col);
        }
        return left;
    }

    std::shared_ptr<ASTNode> parseMultiplication() {
        auto left = parseUnary();
        while (check(TokenType::MULTIPLY) || check(TokenType::DIVIDE) || check(TokenType::MODULO)) {
            auto op = advance().type;
            auto right = parseUnary();
            left = std::make_shared<BinaryOpNode>(op, std::move(left), std::move(right), current().line, current().col);
        }
        return left;
    }

    std::shared_ptr<ASTNode> parseUnary() {
        if (check(TokenType::NOT) || check(TokenType::MINUS)) {
            auto op = advance().type;
            auto operand = parseUnary();
            return std::make_shared<UnaryOpNode>(op, std::move(operand), current().line, current().col);
        }
        return parseCall();
    }

    std::shared_ptr<ASTNode> parseCall() {
        auto expr = parsePrimary();

        while (true) {
            if (match(TokenType::LPAREN)) {
                std::vector<std::shared_ptr<ASTNode>> args;
                if (!check(TokenType::RPAREN)) {
                    do {
                        args.push_back(parseExpression());
                    } while (match(TokenType::COMMA));
                }
                expect(TokenType::RPAREN, "Expected ')' after arguments");
                expr = std::make_shared<CallNode>(std::move(expr), std::move(args), current().line, current().col);
            } else if (match(TokenType::DOT)) {
                // Allow keywords as property names after '.'
                std::string propName;
                if (check(TokenType::IDENTIFIER)) {
                    propName = advance().value;
                } else {
                    // Accept any keyword-like token as a property name
                    auto& tok = current();
                    // Check if it's a keyword that can be used as property name
                    switch (tok.type) {
                        case TokenType::CHANNEL:
                        case TokenType::SIGNAL:
                        case TokenType::STUN:
                        case TokenType::STREAM:
                        case TokenType::BROADCAST:
                        case TokenType::RELAY:
                        case TokenType::CONNECT:
                        case TokenType::PEER:
                        case TokenType::ICE:
                        case TokenType::CANDIDATE:
                        case TokenType::ROOM:
                        case TokenType::OFFER:
                        case TokenType::ANSWER:
                        case TokenType::DELETE:
                        case TokenType::UPDATE:
                        case TokenType::CREATE:
                        case TokenType::NEW:
                        case TokenType::DB:
                        case TokenType::FETCH:
                        case TokenType::FROM:
                            propName = advance().value;
                            break;
                        default:
                            ErrorHandler::throwSyntaxError("Expected property name after '.'", tok.line, tok.col);
                            break;
                    }
                }
                expr = std::make_shared<DotAccessNode>(std::move(expr), propName, current().line, current().col);
            } else if (match(TokenType::LBRACKET)) {
                auto index = parseExpression();
                expect(TokenType::RBRACKET, "Expected ']'");
                expr = std::make_shared<IndexAccessNode>(std::move(expr), std::move(index), current().line, current().col);
            } else {
                break;
            }
        }

        return expr;
    }

    std::shared_ptr<ASTNode> parsePrimary() {
        if (match(TokenType::NUMBER)) {
            try { return std::make_shared<NumberNode>(std::stod(tokens_[pos_-1].value), tokens_[pos_-1].line, tokens_[pos_-1].col); }
            catch (...) { return std::make_shared<NumberNode>(0, tokens_[pos_-1].line, tokens_[pos_-1].col); }
        }
        if (match(TokenType::STRING)) {
            return std::make_shared<StringNode>(tokens_[pos_-1].value, tokens_[pos_-1].line, tokens_[pos_-1].col);
        }
        if (match(TokenType::TRUE))  return std::make_shared<BoolNode>(true, tokens_[pos_-1].line, tokens_[pos_-1].col);
        if (match(TokenType::FALSE)) return std::make_shared<BoolNode>(false, tokens_[pos_-1].line, tokens_[pos_-1].col);
        if (match(TokenType::NULL_T)) return std::make_shared<NullNode>(tokens_[pos_-1].line, tokens_[pos_-1].col);

        if (match(TokenType::DECLARATOR)) {
            auto name = expect(TokenType::IDENTIFIER, "Expected variable name after '$'");
            return std::make_shared<VariableNode>(name.value, name.line, name.col);
        }

        if (match(TokenType::IDENTIFIER)) {
            return std::make_shared<VariableNode>(tokens_[pos_-1].value, tokens_[pos_-1].line, tokens_[pos_-1].col);
        }

        // Keywords that can be used as identifiers (global objects: db, fetch, http, json)
        if (match(TokenType::DB)) {
            return std::make_shared<VariableNode>("db", tokens_[pos_-1].line, tokens_[pos_-1].col);
        }
        if (match(TokenType::FETCH)) {
            return std::make_shared<VariableNode>("fetch", tokens_[pos_-1].line, tokens_[pos_-1].col);
        }

        // new ClassName(args) — instantiation
        if (match(TokenType::NEW)) {
            int nLine = tokens_[pos_-1].line, nCol = tokens_[pos_-1].col;
            auto className = expect(TokenType::IDENTIFIER, "Expected class name after 'new'");
            // The CallNode in parseCall will handle the (args) part
            // We return a VariableNode for the class name, and parseCall wraps it
            return std::make_shared<VariableNode>(className.value, nLine, nCol);
        }

        // super() call for parent constructor
        if (match(TokenType::SUPER)) {
            int sLine = tokens_[pos_-1].line, sCol = tokens_[pos_-1].col;
            if (match(TokenType::LPAREN)) {
                std::vector<std::shared_ptr<ASTNode>> args;
                if (!check(TokenType::RPAREN)) {
                    do { args.push_back(parseExpression()); } while (match(TokenType::COMMA));
                }
                expect(TokenType::RPAREN, "Expected ')' after super() arguments");
                return std::make_shared<SuperNode>(std::move(args), sLine, sCol);
            }
            // super.method() — treat as variable "super" for dot access
            return std::make_shared<VariableNode>("super", sLine, sCol);
        }

        if (match(TokenType::LPAREN)) {
            auto expr = parseExpression();
            expect(TokenType::RPAREN, "Expected ')'");
            return expr;
        }

        if (match(TokenType::LBRACKET)) {
            std::vector<std::shared_ptr<ASTNode>> elements;
            if (!check(TokenType::RBRACKET)) {
                do { elements.push_back(parseExpression()); } while (match(TokenType::COMMA));
            }
            expect(TokenType::RBRACKET, "Expected ']'");
            return std::make_shared<ListNode>(std::move(elements), tokens_[pos_-1].line, tokens_[pos_-1].col);
        }

        if (match(TokenType::LBRACE)) {
            std::vector<std::pair<std::string, std::shared_ptr<ASTNode>>> pairs;
            if (!check(TokenType::RBRACE)) {
                do {
                    auto key = expect(TokenType::STRING, "Expected string key in dict");
                    expect(TokenType::COLON, "Expected ':' after key");
                    auto val = parseExpression();
                    pairs.emplace_back(key.value, std::move(val));
                } while (match(TokenType::COMMA));
            }
            expect(TokenType::RBRACE, "Expected '}'");
            return std::make_shared<DictNode>(std::move(pairs), tokens_[pos_-1].line, tokens_[pos_-1].col);
        }

        ErrorHandler::throwSyntaxError("Unexpected token: '" + current().value + "'", current().line, current().col);
        return std::make_shared<NullNode>(current().line, current().col);
    }
};
